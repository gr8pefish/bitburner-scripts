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

// TODO: ram network

// class RamNetwork {
//     #blockID: number;
//     #blockSize: number;
//     constructor() {}
// }