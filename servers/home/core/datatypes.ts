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


export type ServerRam = {
    serverName: string;
    freeRam: number;
}

export class ServerRamNetwork {
    private static instance: ServerRamNetwork;

    private heap: ServerRam[] = []; // Min-heap for freeRam
    private map: Map<string, ServerRam> = new Map(); // Map for quick updates by serverName
    private freeRamMinThreshold: number = 1; // With less than this amount of ram free, the entry won't appear/will be removed

    private constructor() {}

    // Singleton instance
    public static getInstance(): ServerRamNetwork {
        if (!ServerRamNetwork.instance) {
            ServerRamNetwork.instance = new ServerRamNetwork();
        }
        return ServerRamNetwork.instance;
    }

    // Set the exclusion threshold
    public setExclusionThreshold(threshold: number): void {
        this.freeRamMinThreshold = threshold;
        this.rebuildHeap(); // Rebuild the heap to apply the new threshold
    }

    // Add or update a server
    public upsert(serverRam: ServerRam): void {
        const { serverName, freeRam } = serverRam;
    
        if (this.map.has(serverName)) {
            // Update the map
            this.map.set(serverName, serverRam);
    
            // Check if heap rebuild is necessary
            if (freeRam <= this.freeRamMinThreshold) {
                // Server no longer qualifies, rebuild the heap to exclude it
                this.rebuildHeap();
            } else {
                // Update freeRam in-place in the heap
                const index = this.heap.findIndex(s => s.serverName === serverName);
                if (index >= 0) {
                    this.heap[index].freeRam = freeRam;
                    this.bubbleDown(index);
                    this.bubbleUp(index);
                }
            }
        } else {
            // Add new server to map
            this.map.set(serverName, serverRam);
    
            // Only add to heap if it qualifies
            if (freeRam > this.freeRamMinThreshold) {
                this.heap.push(serverRam);
                this.bubbleUp(this.heap.length - 1);
            }
        }
    }

    // Remove a server
    public remove(serverName: string): void {
        if (!this.map.has(serverName)) return;

        this.map.delete(serverName);

        const index = this.heap.findIndex(s => s.serverName === serverName);
        if (index >= 0) {
            this.swap(index, this.heap.length - 1); // Swap with last element
            this.heap.pop(); // Remove last element
            this.bubbleDown(index); // Re-heapify
        }
    }

    // Optimized method to get `x` servers matching `freeRam >= ramBlockSize`
    public getServersWithDynamicUpdateOptimized(
        serverCount: number,
        ramBlockSize: number
    ): ServerRam[] {
        const result: ServerRam[] = [];

        while (result.length < serverCount) {
            const serverRam = this.heap[0]; // Get the smallest freeRam server
            if (!serverRam || serverRam.freeRam <= ramBlockSize) {
                // If no server matches the condition, break
                break;
            }

            // Add the server to the result list
            result.push({ ...serverRam });

            // Update the server's freeRam
            const updatedFreeRam = serverRam.freeRam - ramBlockSize;

            if (updatedFreeRam <= this.freeRamMinThreshold) {
                // Remove the server if it falls below or equals the threshold
                this.remove(serverRam.serverName);
            } else {
                // Update in place and re-heapify
                serverRam.freeRam = updatedFreeRam;
                this.bubbleDown(0); // Maintain the heap property
            }
        }

        return result;
    }

    // Get all servers (optional utility)
    public getAllServers(): ServerRam[] {
        return [...this.heap];
    }

    // Rebuild the heap (used for re-syncing with exclusion threshold)
    private rebuildHeap(): void {
        this.heap = [...this.map.values()].filter(server => server.freeRam > this.freeRamMinThreshold);
        this.heap.sort((a, b) => a.freeRam - b.freeRam); // Ensure min-heap property
    }

    // Heap helpers
    private bubbleUp(index: number): void {
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            if (this.heap[index].freeRam < this.heap[parentIndex].freeRam) {
                this.swap(index, parentIndex);
                index = parentIndex;
            } else {
                break;
            }
        }
    }

    private bubbleDown(index: number): void {
        const lastIndex = this.heap.length - 1;
        while (true) {
            const leftChildIndex = 2 * index + 1;
            const rightChildIndex = 2 * index + 2;
            let smallest = index;

            if (
                leftChildIndex <= lastIndex &&
                this.heap[leftChildIndex].freeRam < this.heap[smallest].freeRam
            ) {
                smallest = leftChildIndex;
            }

            if (
                rightChildIndex <= lastIndex &&
                this.heap[rightChildIndex].freeRam < this.heap[smallest].freeRam
            ) {
                smallest = rightChildIndex;
            }

            if (smallest !== index) {
                this.swap(index, smallest);
                index = smallest;
            } else {
                break;
            }
        }
    }

    private swap(i: number, j: number): void {
        [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
    }
}



