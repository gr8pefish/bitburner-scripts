import { ScriptArg, Server } from "@/NetscriptDefinitions";
import { HWGW_CONSTANTS, HWGW_TYPE, HWGW_TYPES } from "./constants";

//TODO: keep?
// export type HackTimeTypes = {
//     hack: number;
//     grow: number;
//     weaken: number;
// }

export type HWGW_RunTimes = {
    start: number;
    end: number;
}

export type HWGW_ThreadInfo = {
    threadCount: number; 
    ramBlockSize: number; 
}

export class HWGW_Data {
    private times: { [key in HWGW_TYPE]: HWGW_RunTimes };
    private threads: { [key in HWGW_TYPE]: HWGW_ThreadInfo };

    constructor() {
        // Initialize times and threads for each HWGW_TYPE with default values
        this.times = Object.values(HWGW_TYPE).reduce((time, type) => {
            time[type] = { start: 0, end: 0 };
            return time;
        }, {} as { [key in HWGW_TYPE]: HWGW_RunTimes });

        this.threads = Object.values(HWGW_TYPE).reduce((thread, type) => {
            thread[type] = { threadCount: 0, ramBlockSize: 0 };
            return thread;
        }, {} as { [key in HWGW_TYPE]: HWGW_ThreadInfo });
    }

    print(ns: NS): void {
        ns.printf(`HWGW Data:\n${"-".repeat(30)}`);
        for (const type of Object.values(HWGW_TYPE)) {
            const { start, end } = this.times[type];
            const { threadCount, ramBlockSize } = this.threads[type];
            ns.printf(
                `${type.toUpperCase()}:\n` +
                `  Times: ${ns.tFormat(start, true)} -> ${ns.tFormat(end, true)} (${ns.tFormat(end - start, true)})\n` +
                `  Threads: ${threadCount}, RAM Block Size: ${ns.formatRam(ramBlockSize)}`
            );
        }
    }

    // Accessors for specific types
    getRunTimes(type: HWGW_TYPE): HWGW_RunTimes {
        return this.times[type];
    }

    getThreadInfo(type: HWGW_TYPE): HWGW_ThreadInfo {
        return this.threads[type];
    }

    // Mutators for specific types
    setTimes(type: HWGW_TYPE, start: number, end: number): void {
        this.times[type] = { start, end };
    }

    setThreads(type: HWGW_TYPE, threadCount: number): void {
        this.threads[type].threadCount = threadCount;
        this.threads[type].ramBlockSize = threadCount * HWGW_CONSTANTS[type].RAM_COST;
    }

    // Sub-value setters
    setTimeStart(type: HWGW_TYPE, start: number): void {
        this.times[type].start = start;
    }

    setTimeEnd(type: HWGW_TYPE, end: number): void {
        this.times[type].end = end;
    }
}

//TODO: getters/setters for everything, just enforce it
export class Job {
    constructor (
        private scriptName: string,
        private threadCount: number = 1,
        private args: ScriptArg[] = [],
        private hostname?: string,
        private pid?: number,
    ) {};
    print(ns: NS) {
        ns.printf(`Running JOB: ${this.scriptName} with ${this.threadCount} threads and args [${this.args}] on ${this?.hostname} with PID ${this?.pid}`);
    }
    //Need getter/setter because this can mutate elsewhere
    getThreadCount(){
        return this.threadCount;
    }
    setThreadCount(threadCount: number) {
        this.threadCount = threadCount;
    }

    //Generic getters/setters
    getScriptName() {
        return this.scriptName;
    }

    getArgs(): ScriptArg[] {
        return this.args;
    }
    setArgs(args: ScriptArg[]) {
        this.args = args;
    }

    getHostname() {
        return this?.hostname;
    }
    setHostname(hostname: string) {
        this.hostname = hostname;
    }

    getPID(){
        return this?.pid;
    }
    setPID(pid: number) {
        this.pid = pid;
    }

    getRamBlockSize(ns: NS) {
        return ns.getScriptRam(this.getScriptName()) * this.threadCount;
    }
}


export class HWGW_Single_Job extends Job {
    constructor(
        scriptName: string,
        private hwgw_type: HWGW_TYPE, // Define the HWGW type
        private data: HWGW_Data,
        private targetServer: string,
        hostname?: string,
        pid?: number,
    ) {
        // Automatically set args to [target, startTime, endTime]
        super(scriptName, data.getThreadInfo(hwgw_type).threadCount, [targetServer, data.getRunTimes(hwgw_type).start, data.getRunTimes(hwgw_type).end], hostname, pid);
    }

    //IMPORTANT: update/sync thread data when updating data, as it is stored in two places
    updateThreadCount(threadCount: number) {
        this.data.setThreads(this.hwgw_type, threadCount); //updates ramBlockSize too
        this.setThreadCount(threadCount);
    }
    getData(): HWGW_Data {
        return this.data;
    }
    setData(data: HWGW_Data) {
        this.data = data;
        this.updateThreadCount(data.getThreadInfo(this.hwgw_type).threadCount);
    }
    getRamBlockSize(): number {
        return this.getData().getThreadInfo(this.getHWGWtype()).ramBlockSize;
    }

    //custom
    setTimeStart(startTime: number) {
        this.getData().setTimeStart(this.getHWGWtype(), startTime);
    }
    getTimeStart(): number {
        return this.getData().getRunTimes(this.getHWGWtype()).start;
    }

    setTimeEnd(endTime: number) {
        this.getData().setTimeEnd(this.getHWGWtype(), endTime);
    }
    getTimeEnd(): number {
        return this.getData().getRunTimes(this.getHWGWtype()).end;
    }

    //generics
    getHWGWtype(): HWGW_TYPE {
        return this.hwgw_type;
    }
    getTargetServer(): string {
        return this.targetServer;
    }
    setTargetServer(target: string) {
        this.targetServer = target;
    }

    print(ns: NS): void {
        super.print(ns); // Call the parent class's print method
        const times = this.data.getRunTimes(this.hwgw_type);
        ns.printf(
            `HWGW DETAILS\nTarget: ${this.targetServer}, Hack Type: ${this.hwgw_type}, RamBlockSize: ${ns.formatRam(this.data.getThreadInfo(this.hwgw_type).ramBlockSize)}, Start Time: ${times.start}, End Time: ${times.end}`
        );
    }
}

export type JobMap = { [key in HWGW_TYPE]: HWGW_Single_Job };

export class HWGW_Jobs {
    constructor (
        private target: string,
        private leechPercent: number,
        private jobs: JobMap,
    ) {};
    //Helper method(s)
    getTotalRam(): number {
        return Object.values(this.jobs).reduce((total, job) => total + job.getData().getThreadInfo(job.getHWGWtype()).ramBlockSize, 0);
    }
    //Getters and setters (simple)
    getTarget(): string {
        return this.target;
    }
    setTarget(target: string) {
        this.target = target;
    }

    getLeechPercent(): number {
        return this.leechPercent;
    }
    setLeechPercent(leechPercent: number) {
        this.leechPercent = leechPercent;
    }

    getJobs(): JobMap {
        return this.jobs;
    }
    setJobs(jobMap: JobMap) {
        this.jobs = jobMap;
    }
    setJob(type: HWGW_TYPE, job: HWGW_Single_Job) {
        this.jobs[type] = job;
    }
    //Print
    print(ns: NS) {
        ns.print(`Attempting to leech ${ns.formatPercent(this.leechPercent)} from ${this.target}`);
        ns.print(`--Total RAM Needed--`)
        ns.print(ns.formatRam(this.getTotalRam()));
    }
}

export type HWGW_BATCH_SCHEDULE_TYPES = 'SHOTGUN' | 'JIT';

export class HWGW_Batch {
    constructor(
        private target: string,
        private allJobs: HWGW_Jobs[],
        private batchType: HWGW_BATCH_SCHEDULE_TYPES,
        private batchBufferMS: number,
        private targetHostsRamUse: number,
    ) {};

    // Getters & Setters
    getTarget(): string {
        return this.target;
    }
    setTarget(target: string) {
        this.target = target;
    }

    getAllJobs(): HWGW_Jobs[] {
        return this.allJobs;
    }
    setAllJobs(allJobs: HWGW_Jobs[]) {
        this.allJobs = allJobs;
    }

    getBatchType(): HWGW_BATCH_SCHEDULE_TYPES {
        return this.batchType;
    }
    setBatchType(batchType: HWGW_BATCH_SCHEDULE_TYPES) {
        this.batchType = batchType;
    }

    getBatchBufferMS(): number {
        return this.batchBufferMS;
    }
    setBatchBufferMS(batchBufferMS: number) {
        this.batchBufferMS = batchBufferMS;
    }

    getTargetHostsRamUse(): number {
        return this.targetHostsRamUse;
    }
    setTargetHostsRamUse(targetHostsRamUse: number) {
        this.targetHostsRamUse = targetHostsRamUse;
    }

    // Helper Methods
    getTotalBatchRam(): number {
        return this.allJobs.reduce((total, jobSet) => total + jobSet.getTotalRam(), 0);
    }

    getJobsForType(type: HWGW_TYPE): HWGW_Single_Job[] {
        return this.allJobs.map(jobSet => jobSet.getJobs()[type]).filter(job => !!job);
    }

    // Print Method
    print(ns: NS): void {
        ns.print(`Batch Information for Target: ${this.target}`);
        ns.print(`Batch Type: ${this.batchType}`);
        ns.print(`Batch Buffer: ${this.batchBufferMS}ms`);
        ns.print(`Target Hosts RAM Use: ${ns.formatRam(this.targetHostsRamUse)}`);
        ns.print(`-- Total RAM Usage Across Jobs --`);
        ns.print(ns.formatRam(this.getTotalBatchRam()));

        for (const [index, jobSet] of this.allJobs.entries()) {
            ns.print(`Job Set #${index + 1}:`);
            jobSet.print(ns);
        }
    }
}


export type MathRoundType = Math["floor"] | Math["ceil"] | null;


//------------------------------- RAM Network -----------------------------------

export enum ServerSubset {
    ALL = "ALL",
    NOT_OWNED = "NOT_OWNED",
    HOME_ONLY = "HOME_ONLY",
    PSERV_ONLY = "PSERV_ONLY",
    ALL_BUT_HOME = "ALL_BUT_HOME",
}

// Define the mapping of ServerSubset to predicates
export const serverSubsetPredicates: Record<ServerSubset, (server: Server) => boolean> = {
    [ServerSubset.ALL]: () => true, // Include all servers
    [ServerSubset.NOT_OWNED]: (server) => !server.purchasedByPlayer, //!server.hostname.startsWith("pserv-") && server.hostname !== "home",
    [ServerSubset.HOME_ONLY]: (server) => server.hostname === "home",
    [ServerSubset.PSERV_ONLY]: (server) => server.purchasedByPlayer && server.hostname.startsWith("pserv-"),
    [ServerSubset.ALL_BUT_HOME]: (server) => server.hostname !== "home",
};

export type HostnameToThreads = Map<string, number>;

//todo: Simulated ram w/ copy of server (& either new class or hostname matching)

/**
 * Server to define RamNetwork, a collection of servers and their ram amounts
 * Contains a Server[] that is filtered and sorted (default freeRamAsc, and > 1gb freeRam w/ adminRights)
 */
export class ServerRamNetwork {

    //---------------------- Private --------------------------

    private servers: Server[] = [];
    private sortComparator: (a: Server, b: Server) => number;
    private filterPredicate: (server: Server) => boolean;
    private simulatedAddtlRamUsed: Map<string, number> = new Map(); // <serverName, additionalRamUsed>;

    private filterSortInPlace(source: Server[], filterPredicates?: ((server: Server) => boolean)[], sortComparator?: (a: Server, b: Server) => number): void {
        // Use defaults for filterPredicates and sortComparator
        const predicates = filterPredicates || [this.filterPredicate];
        const comparator = sortComparator || this.sortComparator;
    
        // Apply all predicates if provided
        const filtered = predicates.length > 0
            ? source.filter(server => predicates.every(predicate => predicate(server)))
            : source;
    
        // Check if filtering changes the size
        if (filtered.length === source.length) {
            // No filtering occurred; sort the original array in place
            source.sort(comparator);
        } else {
            // Filtering occurred; clear and replace the array with filtered results
            source.length = 0; // Clear the array
            source.push(...filtered.sort(comparator)); // Push sorted filtered elements
        }
    }

    //---------------------- Constructor & Defaults --------------------------

    public constructor(serverList: Server[], sortComparator?: (a: Server, b: Server) => number, filterPredicate?: (server: Server) => boolean) {
        // Default comparator orders by maxRam ascending, including any simulated ram too if relevant
        const defaultSortComparator = (a: Server, b: Server) => {
            return this.getEffectiveFreeRam(a) - this.getEffectiveFreeRam(b); // Sort by ascending effective RAM
        };
        // Default filtering of freeFram > 1(gb)
        const defaultFilterPredicate = (server: Server) => server.hasAdminRights && this.getEffectiveFreeRam(server) >= 1;

        this.sortComparator = sortComparator || defaultSortComparator;
        this.filterPredicate = filterPredicate || defaultFilterPredicate;

        this.addMultiple(serverList);
    }

    public updateDefaultSortComparator(sortComparator: (a: Server, b: Server) => number) {
        this.sortComparator = sortComparator;
        this.reSort();
    }

    public updateDefaultFilterPredicate(filterPredicate: (server: Server) => boolean) {
        this.filterPredicate = filterPredicate;
        this.reSort();
    }

    //---------------------- Update Data --------------------------

    // Add multiple servers, mostly for init (overengineered?)
    public addMultiple(servers: Server[]): void {
        const filteredServers = servers.filter(this.filterPredicate); // Filter incoming servers
        const existingHostnames = new Set(this.servers.map(s => s.hostname)); // Track existing servers by hostname
    
        // Add only new servers
        for (const server of filteredServers) {
            if (existingHostnames.has(server.hostname)) continue; // Skip duplicates
            this.servers.push(server);
        }
    
        // Sort in place
        this.servers.sort(this.sortComparator);
    }

    //TODO: a method for update/add simulated necessary?

    public addSimulated(serverName: string, addtlSimulatedRamUse: number) {
        const newRamUse = this.simulatedAddtlRamUsed.has(serverName) ? this.simulatedAddtlRamUsed.get(serverName) + addtlSimulatedRamUse : addtlSimulatedRamUse;
        this.simulatedAddtlRamUsed.set(serverName, newRamUse);
        // reSortAroundIndex TODO: optimize for reSortFull only when needed
        this.reSort();
    }

    public removeSimulated(serverName: string) {
        if (this.simulatedAddtlRamUsed.has(serverName)) {
            this.simulatedAddtlRamUsed.delete(serverName);
        }
        this.reSort();
    }

    public reSort() {
        this.reSortList(this.servers);
    }

    public reSortList(serverList: Server[]) {
        this.filterSortInPlace(serverList);
    }
    
    //---------------------- Getters --------------------------

    public getEffectiveFreeRam(server: Server): number {
        const simulatedUsedRam = this.simulatedAddtlRamUsed.get(server.hostname) || 0;
        return server.maxRam - (server.ramUsed + simulatedUsedRam);
    }

    // Get a subset of servers based on filtering predicate (combines with default filtering comparator, and returns sorted)
    // NOTE: MODIFIES BASE SERVER LIST
    public setSubset(filterPredicate: (server: Server) => boolean): Server[] {
        return this.getSubsetMult([this.filterPredicate, filterPredicate]);
    }

    // Get a subset of servers based on multiple filtering predicate (combines with default filtering comparator, and returns sorted)
    // NOTE: MODIFIES BASE SERVER LIST
    private getSubsetMult(filterPredicates: ((server: Server) => boolean)[]): Server[] {
        this.filterSortInPlace(this.servers, [this.filterPredicate, ...filterPredicates]);
        return this.servers;
    }


    // relatively unsafe
    public getNextDirectly(): Server {
        return this.servers.at(0);
    }

    // relatively unsafe
    public getLastDirectly(): Server {
        return this.servers.at(-1);
    }

    // Automatically applies simulated to ram counts
    public getNextMatching(predicate: (server: Server) => boolean): Server | undefined {
        return this.servers.find(server =>
            predicate({
                ...server,
                ramUsed: server.ramUsed + (this.simulatedAddtlRamUsed.get(server.hostname) || 0),
            })
        );
    }

    // Get all servers (WARNING: may not be updated with simulated or other details)
    public getAllServersRaw(): Server[] {
        return this.servers;
    }

    //---------------------- Display --------------------------
    
    public toPrintString(ns: NS): string {
        let returnString = `ServerRam Network\n${"-".repeat(65)}\nServer Name        | Free RAM   |  (Max - Simulated + Used) \n${"-".repeat(65)}\n`;
        for (const server of this.servers) {
            returnString += server.hostname.padEnd(19) + "| " + ns.formatRam(this.getEffectiveFreeRam(server)).padStart(9);

            const simulated = this.simulatedAddtlRamUsed.get(server.hostname) || 0;
            if (simulated > 0) {
                 returnString += "  |  (" + ns.formatRam(server.maxRam) + " - " + ns.formatRam(simulated) + " + " +  ns.formatRam(server.ramUsed) + ")";
            }
            returnString += "\n"
        }
        return returnString;
    }

    //---------------- Update -------------------------

    public updateAfterExec(serverToUpdate: Server, removeSimulated = true): void {
        const index = this.servers.findIndex(server => server.hostname === serverToUpdate.hostname);

        if (removeSimulated) {
            this.removeSimulated(serverToUpdate.hostname);
        }
    
        // Check if the server matches the default filtering predicate
        if (this.filterPredicate(serverToUpdate)) {
            if (index !== -1) {
                // Update the server if it exists
                this.servers[index] = serverToUpdate;
            } else {
                // Add the server if it passes the filter but doesn't exist
                this.servers.push(serverToUpdate);
            }
    
            // Sort only around the updated or added element if necessary
            this.reSortAroundIndex(serverToUpdate);
        } else {
            // Remove the server if it no longer matches the filter
            if (index !== -1) {
                this.servers.splice(index, 1);
            }
        }

    }
    
    // Helper: ReSort around a specific server (optimized for minimal changes)
    private reSortAroundIndex(server: Server): void {
        const index = this.servers.findIndex(s => s.hostname === server.hostname);
    
        if (index !== -1) {
            const comparator = this.sortComparator;
    
            // Apply bubble-up or bubble-down logic to maintain order
            if (index > 0 && comparator(this.servers[index], this.servers[index - 1]) < 0) {
                this.bubbleUp(index);
            } else if (index < this.servers.length - 1 && comparator(this.servers[index], this.servers[index + 1]) > 0) {
                this.bubbleDown(index);
            }
        }
    }
    
    // Bubble-up method (shift the element up if it's smaller than its predecessor)
    private bubbleUp(index: number): void {
        const element = this.servers[index];
        while (index > 0 && this.sortComparator(element, this.servers[index - 1]) < 0) {
            this.servers[index] = this.servers[index - 1];
            index--;
        }
        this.servers[index] = element;
    }
    
    // Bubble-down method (shift the element down if it's larger than its successor)
    private bubbleDown(index: number): void {
        const element = this.servers[index];
        while (
            index < this.servers.length - 1 &&
            this.sortComparator(element, this.servers[index + 1]) > 0
        ) {
            this.servers[index] = this.servers[index + 1];
            index++;
        }
        this.servers[index] = element;
    }
    

}
