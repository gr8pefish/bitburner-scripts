import { ScriptArg, Server } from "@/NetscriptDefinitions";
import { HWGW_CONSTANTS, HWGW_TYPES } from "./constants";

export class HWGW_ThreadCounts {
    constructor(
        public hackThreads: number = 0,
        public weaken1Threads: number = 0,
        public growThreads: number = 0,
        public weaken2Threads: number = 0,
    ) {};
    print(ns: NS) {
        ns.printf(`Hack Threads:    ${this.hackThreads}`);
        ns.printf(`Weaken1 Threads: ${this.weaken1Threads}`);
        ns.printf(`Grow Threads:    ${this.growThreads}`);
        ns.printf(`Weaken2 Threads: ${this.weaken2Threads}`);
    }
}

export type HackTimes = {
    HackTime: number;
    GrowTime: number;
    WeakenTime: number;
}

export class HWGW_StartEndTimes {
    constructor(
        public hackStart: number = 0,
        public hackEnd: number = 0,
        public weaken1Start: number = 0,
        public weaken1End: number = 0,
        public growStart: number = 0,
        public growEnd: number = 0,
        public weaken2Start: number = 0,
        public weaken2End: number = 0,
    ) {};
    print(ns: NS) {
        ns.printf(`Hack:    ${ns.tFormat(this.hackStart, true)} -> ${ns.tFormat(this.hackEnd, true)}: (${ns.tFormat(this.hackEnd - this.hackStart, true)})`);
        ns.printf(`Weaken1: ${ns.tFormat(this.weaken1Start, true)} -> ${ns.tFormat(this.weaken1End, true)}: (${ns.tFormat(this.weaken1End - this.weaken1Start, true)})`);
        ns.printf(`Grow:    ${ns.tFormat(this.growStart, true)} -> ${ns.tFormat(this.growEnd, true)}: (${ns.tFormat(this.growEnd - this.growStart, true)})`);
        ns.printf(`Weaken2: ${ns.tFormat(this.weaken2Start, true)} -> ${ns.tFormat(this.weaken2End, true)}: (${ns.tFormat(this.weaken2End - this.weaken2Start, true)})`);
    }
}

export class HWGW_RamBlocks {
    threadCounts: HWGW_ThreadCounts;
    hackRamBlock: number;
    weaken1RamBlock: number;
    growRamBlock: number;
    weaken2RamBlock: number;
    constructor(threadCounts: HWGW_ThreadCounts) {
        this.threadCounts = threadCounts;
        this.hackRamBlock = this.threadCounts.hackThreads * HWGW_CONSTANTS.hack.RAM_COST;
        this.weaken1RamBlock = this.threadCounts.weaken1Threads * HWGW_CONSTANTS.weaken1.RAM_COST;
        this.growRamBlock = this.threadCounts.growThreads * HWGW_CONSTANTS.grow.RAM_COST;
        this.weaken2RamBlock = this.threadCounts.weaken2Threads * HWGW_CONSTANTS.weaken2.RAM_COST;
    };
    print(ns: NS) {
        ns.printf(`Hack RAM block size:    ${ns.formatRam(this.hackRamBlock)}`);
        ns.printf(`Weaken1 RAM block size: ${ns.formatRam(this.weaken1RamBlock)}`);
        ns.printf(`Grow RAM block size:    ${ns.formatRam(this.growRamBlock)}`);
        ns.printf(`Weaken2 RAM block size: ${ns.formatRam(this.weaken2RamBlock)}`);
    }
}

export class Job {
    constructor (
        public scriptName: string,
        public threads: number = 1,
        public args: ScriptArg[] = [],
        public hostname?: string,
        public pid?: number,
    ) {};
    print(ns: NS) {
        ns.printf(`JOB: ${this.scriptName} with ${this.threads} threads and args [${this.args}]`);// on ${this.hostName} with pid ${this.pid}`);
    }
}

export class HWGW_Job {
    constructor (
        public hwgw_type: typeof HWGW_TYPES[number], //h, w1, g, w2
        public threads: number,
        public startTime: number,
        public endTime: number,
        public ramBlock: number, //size
        public host: string,
    ) {};
    print(ns: NS) {
        ns.print(`Running job ${this.hwgw_type} with ${this.threads} threads (${ns.formatRam(this.ramBlock)}) on ${this.host} from ${ns.tFormat(this.startTime, true)} to ${ns.tFormat(this.endTime, true)}`);
    }
}

export class HWGW_Batch {
    constructor (
        public target: string,
        public leechPercent: number,
        public threads: HWGW_ThreadCounts, //TODO: refactor to just be job[]?
        public timings: HWGW_StartEndTimes,
        public ramBlocks: HWGW_RamBlocks,
    ) {};
    print(ns: NS) {
        ns.print(`Attempting to leech ${ns.formatPercent(this.leechPercent)} from ${this.target}`);
        ns.print(`--RAM--`)
        this.ramBlocks.print(ns);
        ns.print(`--Threads--`)
        this.threads.print(ns);
        ns.print(`--Timing--`)
        this.timings.print(ns);
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

    private getEffectiveFreeRam(server: Server): number {
        const simulatedUsedRam = this.simulatedAddtlRamUsed.get(server.hostname) || 0;
        return server.maxRam - (server.ramUsed + simulatedUsedRam);
    }

    // private filterSortInPlace(source: Server[], filterPredicates?: ((server: Server) => boolean)[], sortComparator?: (a: Server, b: Server) => number): void {
    //     const predicates = filterPredicates || [this.filterPredicate];
    //     const comparator = sortComparator || this.sortComparator;

    //     // this.testNS.printf(`Filter Pred: ${predicates.toString}`);
    //     const noods = source.find(s => s.hostname == 'n00dles')
    //     // this.testNS.printf(`Noods Index: ${source.findIndex(s => s.hostname == 'n00dles')}`);
    //     this.testNS.printf(`Noods Ram Used (internal sort): ${this.testNS.formatRam(noods.ramUsed)}`);
    //     this.testNS.printf(`Noods Ram Sim (internal sort): ${this.testNS.formatRam(this.simulatedAddtlRamUsed.get('n00dles'))}`);
    
    //     // Filter elements in place
    //     let index = 0;
    //     while (index < source.length) {
    //         if (!predicates.every(predicate => predicate(source[index]))) {
    //             source.splice(index, 1); // Remove elements not matching predicates
    //         } else {
    //             index++;
    //         }
    //     }

    //     // this.testNS.printf(`Noods Index 2: ${source.findIndex(s => s.hostname == 'n00dles')}`);
    
    //     // Sort remaining elements
    //     source.sort(comparator);
    //     // this.testNS.printf(`Noods Index 3: ${source.findIndex(s => s.hostname == 'n00dles')}`);
    // }
    

    //---------------------- Constructor & Defaults --------------------------

    public constructor(serverList: Server[], sortComparator?: (a: Server, b: Server) => number, filterPredicate?: (server: Server) => boolean) {
        // Default comparator orders by maxRam ascending, including any simulated ram too if relevant
        const defaultSortComparator = (a: Server, b: Server) => {
            this.getEffectiveFreeRam(a) - this.getEffectiveFreeRam(b);
            const simulated = (server: Server) => this.simulatedAddtlRamUsed.get(server.hostname) || 0;
            const effectiveRamA = a.maxRam - (a.ramUsed + simulated(a));
            const effectiveRamB = b.maxRam - (b.ramUsed + simulated(b));
            return effectiveRamA - effectiveRamB; // Sort by ascending effective RAM
        };
        // Default filtering of freeFram > 1(gb)
        const defaultFilterPredicate = (server: Server) => server.hasAdminRights && server.maxRam - server.ramUsed >= 1;

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

    public setSimulated(serverName: string, addtlSimulatedRamUse: number) {
        this.simulatedAddtlRamUsed.set(serverName, addtlSimulatedRamUse);
        this.reSort();
    }

    public removeSimulated(serverName: string) {
        if (this.simulatedAddtlRamUsed.has(serverName)) {
            this.simulatedAddtlRamUsed.delete(serverName);
        }
        this.reSort();
    }

    // Update an existing server using a subset of servers and returns the updated subset, filtered and sorted
    //TODO: more simulation
    private update(server: Server, serverList: Server[]): Server[] {
        const subsetIndex = serverList.findIndex(s => s.hostname === server.hostname);

        // Remove the server from both lists if it doesn't satisfy the filtering comparator
        if (!this.filterPredicate(server)) {
            if (subsetIndex !== -1) serverList.splice(subsetIndex, 1);
            const mainIndex = this.servers.findIndex(s => s.hostname === server.hostname);
            if (mainIndex !== -1) this.servers.splice(mainIndex, 1);

            return serverList.sort(this.sortComparator);
        }

        // Update the server in the subset
        if (subsetIndex !== -1) {
            serverList.splice(subsetIndex, 1); // Remove the old entry
        }
        serverList.push(server);

        // Update the server in the main list
        const mainIndex = this.servers.findIndex(s => s.hostname === server.hostname);
        if (mainIndex !== -1) {
            this.servers.splice(mainIndex, 1); // Remove the old entry
        }
        this.servers.push(server);

        // Sort both lists by the ordering comparator
        serverList.sort(this.sortComparator);
        this.servers.sort(this.sortComparator);

        return serverList;
    }

    // // Add or update a server in the ordered set, simply unnecessary?
    // public upsert(server: Server): void {
    //     if (!this.filterPredicate(server)) return;
    //     const existingIndex = this.servers.findIndex(s => s.hostname === server.hostname);
    //     if (existingIndex !== -1) {
    //         // Update the existing server
    //         this.servers.splice(existingIndex, 1); // Remove the old entry
    //     }
    //     // Add the new server and re-sort (already filtered)
    //     this.servers.push(server);
    //     this.servers.sort(this.sortComparator);
    // }


    public reSort() {
        this.reSortList(this.servers);
    }

    public reSortList(serverList: Server[]) {
        this.filterSortInPlace(serverList);
    }
    
    //---------------------- Getters --------------------------

    // Get a subset of servers based on filtering predicate (combines with default filtering comparator, and returns sorted)
    // NOTE: MODIFIES BASE SERVER LIST
    private getSubset(filterPredicate: (server: Server) => boolean): Server[] {
        return this.getSubsetMult([this.filterPredicate, filterPredicate]);
    }

    // Get a subset of servers based on multiple filtering predicate (combines with default filtering comparator, and returns sorted)
    // NOTE: MODIFIES BASE SERVER LIST
    private getSubsetMult(filterPredicates: ((server: Server) => boolean)[]): Server[] {
        this.filterSortInPlace(this.servers, [this.filterPredicate, ...filterPredicates]);
        return this.servers;
    }


    public getNext(): Server {
        return this.servers[0];
    }

    public getNextMatching(predicate: (server: Server) => boolean): Server {
        return this.servers.find(predicate);
    }

    //TODO: merge somehow, so it always includes simulated?
    public getNextSimulatedMatching(ramBlockMin: number): Server | undefined {
        const predicate = (server: Server) => {
            // Calculate effective RAM available after considering simulated usage
            const simulatedUsedRam = this.simulatedAddtlRamUsed.get(server.hostname) || 0;
            const effectiveFreeRam = server.maxRam - (server.ramUsed + simulatedUsedRam);
    
            // Return true if effective free RAM meets or exceeds the required block
            return effectiveFreeRam >= ramBlockMin;
        };
    
        // Find and return the first matching server
        return this.servers.find(predicate);
    }

    // Get all servers (may not be updated)
    public getAll(): Server[] {
        return this.servers;
    }

    // Get all servers (updated)
    private getAllUpdated(): Server[] {
        this.reSort();
        return this.servers;
    }

    //---------------------- Display --------------------------
    
    public toPrintString(ns: NS): string {
        let returnString = `ServerRam Network\n${"-".repeat(20)}\nServer Name        |  Free RAM\n${"-".repeat(10)}\n`;
        for (const server of this.servers) {
            const simulated = this.simulatedAddtlRamUsed.get(server.hostname) || 0;
            const freeRam = server.maxRam - server.ramUsed;
            returnString += server.hostname.padEnd(19) + "| " + ns.formatRam(freeRam).padStart(9)
            if (simulated > 0) {
                 returnString += " (" + ns.formatRam(simulated)+ ")";
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
