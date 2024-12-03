import { calculateRamUsage, getBestTargetsNaiive, getHgwExecTimes, getHWGWThreadCounts, getOptimalLeechPercent, getStartEndTimes } from '../hackUtils';
import { HWGW_CONSTANTS, HWGW_TYPE, HWGW_TYPES } from '../../core/constants';
import { HWGW_ThreadCounts, HWGW_StartEndTimes, HWGW_RamBlocks, HWGW_Job, ServerSubset, Job, Batch_Job } from '../../core/datatypes';
import { isPrepped, iterativePrepImproved } from '../prep';
import { disableLog, freeRamPredicate, getFreeRAM, RamNetwork } from '../../core/coreUtils';


//@deprecated
// // returns -1 if not enough space in host
function getTotalRamNeeded(ns: NS, threadCounts: HWGW_ThreadCounts, host?: string): number {
    let totalRamNeeded = 
        threadCounts.grow * HWGW_CONSTANTS.grow.RAM_COST +
        threadCounts.hack * HWGW_CONSTANTS.hack.RAM_COST +
        threadCounts.weaken1 * HWGW_CONSTANTS.weaken1.RAM_COST +
        threadCounts.weaken2 * HWGW_CONSTANTS.weaken2.RAM_COST;
    
    if (host) {
        let freePercent = host == 'home' ? 0.1 : 0;
        let freeRam = getFreeRAM(ns, host, freePercent);
        if (totalRamNeeded > freeRam) {
            ns.printf(`ERROR Need ${ns.formatRam(totalRamNeeded - freeRam)} more RAM!`);
            return -1;
        }
    }

    return totalRamNeeded;

}

// Limited by RAM for grow, time for weaken
//TODO: assumes home
// async function exploit(ns: NS, target: string, leechPercent: number, print = false) {

//     let threadCounts = getHWGWThreadCounts(ns, target, leechPercent, print);
//     let ramBlocks = new HWGW_RamBlocks(threadCounts);

//     let ramCost = getTotalRamNeeded(ns, threadCounts, 'home');
//     if (ramCost == -1) {
//         ns.tprint("ERROR Excessive RAM cost, decrease leech %!!!");
//         await ns.sleep(10000);
//         return -1;
//     }

//     let startEndTimes = getStartEndTimes(ns, target, print);

//     ns.printf(`-----------------------------------------------------`);
//     let batch: HWGW_Job[] = [];
//     for (const hwgwType of HWGW_TYPES) {
//         const job = new HWGW_Job(hwgwType, threadCounts[hwgwType+'Threads'], startEndTimes[hwgwType+'Start'], startEndTimes[hwgwType+'End'], ramBlocks[hwgwType+'RamBlock'], 'home');
//         batch.push(job);
//     }

//     for (const job of batch) {
//         ns.exec(HWGW_CONSTANTS[job.hwgw_type].SCRIPT_LOCATION, 'home', {threads: job.threads, temporary: true}, target, job.startTime, job.endTime);
//     }
//     ns.printf(`-----------------------------------------------------`);

//     const BUFFER_BATCH_MS = 100;
    
//     const assumedMoneyGainPerSecond = ns.getServerMaxMoney(target) * leechPercent / (startEndTimes.weaken2.end * 1000)
//     const totalRamUsage = ramBlocks.growRamBlock + ramBlocks.weaken1RamBlock + ramBlocks.hackRamBlock + ramBlocks.weaken2RamBlock;
//     ns.printf(`$/min: ${ns.formatNumber(assumedMoneyGainPerSecond*60)} | RAM: ${ns.formatRam(totalRamUsage)} | Sleeping: ${ns.tFormat(startEndTimes.weaken2.end + BUFFER_BATCH_MS)}`);
//     await ns.sleep(startEndTimes.weaken2.end + BUFFER_BATCH_MS);

// }

async function exploitImproved(ns: NS, target: string, threads: HWGW_ThreadCounts, subset: ServerSubset, optimalLeechPercent: number, verbose = false) {
    let startEndTimes = getStartEndTimes(ns, target, verbose);
    let {maxRamBlock, minRamBlock, ramBlockArray} = calculateRamUsage(threads);
    const network = new RamNetwork(ns, subset, freeRamPredicate(minRamBlock));
    const jobs: Job[] = [];
    for (const [hackType, constants] of Object.entries(HWGW_CONSTANTS)) {
        jobs.push(new Batch_Job(constants.SCRIPT_LOCATION, threads[hackType], HWGW_TYPE[hackType], target, startEndTimes[hackType].start, startEndTimes[hackType].end))
    }

    network.execNetworkMultiple(jobs, {verbose: verbose});

    const BUFFER_BATCH_MS = 100;

    const assumedMoneyGainPerSecond = ns.getServerMaxMoney(target) * optimalLeechPercent / (startEndTimes.weaken2.end * 1000)
    ns.printf(`$/min: ${ns.formatNumber(assumedMoneyGainPerSecond*60)} | Sleeping: ${ns.tFormat(startEndTimes.weaken2.end + BUFFER_BATCH_MS)}`);

    await ns.sleep(startEndTimes[HWGW_TYPE.weaken2].end + BUFFER_BATCH_MS);
}

//For now do the best target at the highest leech% that will fit in ram, will deal with others after formulas
export async function main(ns: NS) {
    disableLog(ns); ns.tail();

    const target = ns.args[0] as string || getBestTargetsNaiive(ns, 1, false)[0];
    // const targetCount = ns.args[1] as number || 9;
    const leechPercent = ns.args[1] as number || 0.9;
    const verbose = ns.args[2] as boolean || true;

    if (target == 'ALL') {
        const targets = getBestTargetsNaiive(ns, 10, true);
        for (const target of targets) {
            ns.run('hack/controllers/protobatcher.js', {}, target, leechPercent); //TODO: hardcoded
        }
    } else {

        if (!isPrepped(ns, target, verbose)) {
            await iterativePrepImproved(ns, target);
        }

        while (isPrepped(ns, target, true)) {
            const subset = ServerSubset.ALL; //TODO: make arg
            const {optimalLeechPercent, hwgwThreads} = getOptimalLeechPercent(ns, target, subset, true); //TODO: return ServerRamNetwork to pass through directly?
            ns.print(`\nRunning batch with Optimal Leech %: ${ns.formatPercent(optimalLeechPercent)}\n`);
            await exploitImproved(ns, target, hwgwThreads, subset, optimalLeechPercent, verbose);
            ns.print(`\n\n----------------`);
        }

    }

    // const flags = ns.flags([
    //     ['targets', "AUTO"],
    //     ['targetCount', 10],
    // ]);
    // if (flags._.length === 0 || flags.help) {
    //     ns.tprint("This script helps visualize the money and security of a server.");
    //     ns.tprint(`USAGE: run ${ns.getScriptName()} SERVER_NAME`);
    //     ns.tprint("Example:");
    //     ns.tprint(`> run ${ns.getScriptName()} n00dles`)
    //     return;
    // }
}



export function autocomplete(data, args) {
    // return [...data.servers]; // This script autocompletes the list of servers.
    return [...data.servers, Object.values(ServerSubset)]
}