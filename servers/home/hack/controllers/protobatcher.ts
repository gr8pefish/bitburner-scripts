import { getHgwExecTimes } from '../hackUtils';
import { HWGW_CONSTANTS, HWGW_TYPES } from '../../core/constants';
import { HWGW_ThreadCounts, HWGW_StartEndTimes, HWGW_RamBlocks, HWGW_Job } from '../../core/datatypes';
import { isPrepped } from '../prep';
import { getFreeRAM } from '../../core/coreUtils';

function getHWGWThreadCounts(ns: NS, target: string, leechPercent: number): HWGW_ThreadCounts {
    // hack is simple, just get the leech amt, floor it
    const hackThreads = Math.floor(ns.hackAnalyzeThreads(target, ns.getServerMaxMoney(target) * leechPercent));
    
    // weaken is easy as well, just account for hack and grow increases, ceil just in case
    const weaken1Threads = Math.ceil((hackThreads * HWGW_CONSTANTS.hack.SEC_CHANGE) / HWGW_CONSTANTS.weaken1.SEC_CHANGE);
    
    // grow is trickier - get multiplier from hackThreads vs maxMoney, and ceil it to ensure growth
    const maxMoney = ns.getServerMaxMoney(target);
    const multFactor = maxMoney / (maxMoney - (maxMoney * (ns.hackAnalyze(target) * hackThreads)));
    const growThreads = Math.ceil(ns.growthAnalyze(target, multFactor)); //TODO: add extra to account for leveling?
    
    // weaken is easy as well, just account for hack and grow increases, ceil just in case
    const weaken2Threads = Math.ceil((growThreads * HWGW_CONSTANTS.grow.SEC_CHANGE) / HWGW_CONSTANTS.weaken2.SEC_CHANGE);

    /** Old print statements */
    // const moneyPrintFrom = ns.getServerMaxMoney(target) - (ns.getServerMaxMoney(target) * leechPercent);
    // ns.print(`hackThreads: ${hackThreads} for ${ns.formatNumber(ns.getServerMaxMoney(target) * leechPercent)} (${ns.formatPercent(leechPercent)} leech, down to ${ns.formatNumber(moneyPrintFrom)})`);
    // ns.print(`weaken1Threads: ${weaken1Threads} for ${(hackThreads * HGW_TYPE.HACK.SEC_INCR)} sec incr from hack (${ns.formatNumber(HGW_TYPE.WEAKEN.SEC_DECR)} decr ea)`);
    // const moneyToPredicted = moneyPrintFrom * multFactor;
    // ns.print(`growThreads: ${growThreads} for ${multFactor} multFactor, should be from ${ns.formatNumber(moneyPrintFrom)} to ${ns.formatNumber(moneyToPredicted)}(${ns.formatNumber(ns.getServerMaxMoney(target))})`);
    // ns.print(`weaken2Threads: ${weaken2Threads} for ${(growThreads * HGW_TYPE.GROW.SEC_INCR)} sec incr from grow (${ns.formatNumber(HGW_TYPE.WEAKEN.SEC_DECR)} decr ea)`);
    // ns.print(`\n`);

    return new HWGW_ThreadCounts(hackThreads, weaken1Threads, growThreads, weaken2Threads);
}

function getStartEndTimes(ns: NS, target: string): HWGW_StartEndTimes {
    let executionTimes = getHgwExecTimes(ns, target);
    
    const BUFFER_MS = 50;

    let startEndTimes = new HWGW_StartEndTimes();

    let longestTime = Math.max(executionTimes.HackTime, executionTimes.GrowTime, executionTimes.WeakenTime); //assuming weaken for now, will break if wrong
    let fullTime = longestTime + (BUFFER_MS * 2); //weaken1 (0start) + (grow + weaken2 buffers)

    //weaken2
    startEndTimes.weaken2End = fullTime;
    startEndTimes.weaken2Start = fullTime - executionTimes.WeakenTime;

    //weaken1
    startEndTimes.weaken1End = longestTime;
    startEndTimes.weaken1Start = 0;

    //hack
    startEndTimes.hackEnd = fullTime - BUFFER_MS * 3;
    startEndTimes.hackStart = startEndTimes.hackEnd - executionTimes.HackTime;

    //grow
    startEndTimes.growEnd = fullTime - BUFFER_MS;
    startEndTimes.growStart = startEndTimes.growEnd - executionTimes.GrowTime;

    //print
    startEndTimes.print(ns);

    return startEndTimes
}

// // returns -1 if not enough space in host
function getTotalRamNeeded(ns: NS, threadCounts: HWGW_ThreadCounts, host?: string): number {
    let totalRamNeeded = 
        threadCounts.growThreads * HWGW_CONSTANTS.grow.RAM_COST +
        threadCounts.hackThreads * HWGW_CONSTANTS.hack.RAM_COST +
        threadCounts.weaken1Threads * HWGW_CONSTANTS.weaken1.RAM_COST +
        threadCounts.weaken2Threads * HWGW_CONSTANTS.weaken2.RAM_COST;
    
    if (host) {
        let freePercent = host == 'home' ? 0.1 : 0;
        let freeRam = getFreeRAM(ns, host, freePercent);
        if (totalRamNeeded > freeRam) {
            return -1;
        }
    }

    return totalRamNeeded;

}

// Limited by RAM for grow, time for weaken
//TODO: assumes home
async function exploit(ns: NS, target: string, leechPercent: number) {

    let threadCounts = getHWGWThreadCounts(ns, target, leechPercent);
    let ramBlocks = new HWGW_RamBlocks(threadCounts);

    let ramCost = getTotalRamNeeded(ns, threadCounts, 'home');
    if (ramCost == -1) {
        ns.tprint("WARN Excessive RAM cost, decrease leech %!!!");
        await ns.sleep(6000);
        return -1;
    }

    let startEndTimes = getStartEndTimes(ns, target);

    ns.printf(`-----------------------------------------------------`)
    let batch: HWGW_Job[] = [];
    for (const hwgwType of HWGW_TYPES) {
        const job = new HWGW_Job(hwgwType, threadCounts[hwgwType+'Threads'], startEndTimes[hwgwType+'Start'], startEndTimes[hwgwType+'End'], ramBlocks[hwgwType+'RamBlock'], 'home');
        batch.push(job);
    }

    for (const job of batch) {
        ns.exec(HWGW_CONSTANTS[job.hwgw_type].SCRIPT_LOCATION, 'home', {threads: job.threads, temporary: true}, target, job.startTime, job.endTime);
    }
    ns.printf(`-----------------------------------------------------`)

    const BUFFER_BATCH_MS = 100;
    await ns.sleep(startEndTimes.weaken2End + BUFFER_BATCH_MS);

}

export async function main(ns: NS) {
    ns.tail();

    const target = ns.args[0] as string;
    const leechPercent = ns.args[1] as number || 0.035;

    while (isPrepped(ns, target, true)) {
        ns.print(`\n`);
        await exploit(ns, target, leechPercent);
        ns.print(`\n\n----------------`);
    }

    ns.tprint(`WARN Server ${target} is NOT prepped!`);
}



export function autocomplete(data, args) {
    return [...data.servers]; // This script autocompletes the list of servers.
}