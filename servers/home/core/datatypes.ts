import { Server } from "@/NetscriptDefinitions";
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

//TODO: NOT SINGLETON, create as needed

/**
 * Server to define RamNetwork, a collection of servers and their ram amounts
 * Contains a Server[] that is filtered and sorted (default freeRamAsc, and > 1gb freeRam w/ adminRights)
 */
export class ServerRamNetwork {

    //---------------------- Private --------------------------

    private static instance: ServerRamNetwork;

    private servers: Server[] = [];
    private sortComparator: (a: Server, b: Server) => number;
    private filterPredicate: (server: Server) => boolean;

    private filterSortInPlace(source: Server[], filterPredicates?: ((server: Server) => boolean)[], sortComparator?: (a: Server, b: Server) => number): Server[] {
        // Use defaults for filterPredicates and sortComparator
        const predicates = filterPredicates ?? [this.filterPredicate];
        const comparator = sortComparator ?? this.sortComparator;
    
        // Apply all predicates if provided
        const filtered = predicates.length > 0
            ? source.filter(server => predicates.every(predicate => predicate(server)))
            : source;
    
        // Check if filtering changes the size
        if (filtered.length === source.length) {
            // No filtering occurred; sort the original array in place
            source.sort(comparator);
            return source;
        } else {
            // Filtering occurred; return a sorted filtered array
            return filtered.sort(comparator);
        }
    }

    //---------------------- Update Defaults --------------------------

    public updateDefaultSortComparator(sortComparator: (a: Server, b: Server) => number) {
        this.sortComparator = sortComparator;
        this.reSort();
    }

    public updateDefaultFilterPredicate(filterPredicate: (server: Server) => boolean) {
        this.filterPredicate = filterPredicate;
        this.reSort();
    }

    //---------------------- Constructor --------------------------

    private constructor(sortComparator: (a: Server, b: Server) => number, filterPredicate: (server: Server) => boolean) {
        this.sortComparator = sortComparator;
        this.filterPredicate = filterPredicate;
    }

    // Singleton instance
    public static getInstance(sortComparator?: (a: Server, b: Server) => number, filterPredicate?: (server: Server) => boolean): ServerRamNetwork {
        if (!ServerRamNetwork.instance) {
            // Default comparator orders by maxRam ascending
            const defaultSortComparator = (a: Server, b: Server) => a.maxRam - b.maxRam;
            // Default filtering of freeFram > 1(gb)
            const defaultFilteringPredicate = (server: Server) => server.hasAdminRights && server.maxRam - server.ramUsed >= 1;

            ServerRamNetwork.instance = new ServerRamNetwork(
                sortComparator || defaultSortComparator,
                filterPredicate || defaultFilteringPredicate
            );
        }
        return ServerRamNetwork.instance;
    }

    //---------------------- Update Data --------------------------

    // Add multiple servers, mostly for init
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

    // Update an existing server using a subset of servers and returns the updated subset, filtered and sorted
    //TODO: more simulation
    public update(server: Server, serverList: Server[]): Server[] {
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

    public reSortList(serverList: Server[]): void {
        this.filterSortInPlace(serverList);
    }
    
    //---------------------- Getters --------------------------

    // Get a subset of servers based on filtering predicate (combines with default filtering comparator, and returns sorted)
    public getSubset(filterPredicate: (server: Server) => boolean): Server[] {
        return this.getSubsetMult([this.filterPredicate, filterPredicate]);
    }

    // Get a subset of servers based on multiple filtering predicate (combines with default filtering comparator, and returns sorted)
    public getSubsetMult(filterPredicates: ((server: Server) => boolean)[]): Server[] {
        return this.filterSortInPlace(this.servers, [this.filterPredicate, ...filterPredicates]);
    }

    // Get all servers (may not be updated)
    public getAll(): Server[] {
        return this.servers;
    }

    // Get all servers (updated)
    public getAllUpdated(): Server[] {
        this.reSort();
        return this.servers;
    }

    //---------------------- Display --------------------------
    
    public toPrintString(ns: NS): string {
        let returnString = `ServerRam Network\n${"-".repeat(20)}\nServer Name        |  Free RAM\n${"-".repeat(10)}\n`;
        for (const server of this.servers) {
            const freeRam = server.maxRam - server.ramUsed;
            returnString += server.hostname.padEnd(19) + "| " + ns.formatRam(freeRam).padStart(9) + "\n";
        }
        return returnString;
    }

}
