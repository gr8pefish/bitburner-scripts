import { Server } from "@/NetscriptDefinitions";
import { HWGW_CONSTANTS, HWGW_TYPE, HWGW_TYPES } from "../core/constants";
import { prepAllServers, getFreeRAM, rootServer, getMaximumThreads, RamNetwork, disableLog } from "../core/coreUtils";
import { Batch_Job, HWGW_StartEndTimes, HWGW_ThreadCounts, ServerSubset } from "../core/datatypes";
import { getHgwExecTimes } from "./hackUtils";

//TODO: redo basically, w/ protobatcher help/datatypes

export async function main(ns: NS) {
    disableLog(ns);
    ns.tail();
    prepAllServers(ns);
    let target = ns.args[0] as string
    await iterativePrepImproved(ns, target)
    ns.printf("SUCCESS Prepped!");
}

export function isPrepped(ns:NS, target: string, verbose = false): boolean {
    if (verbose) {
        let minimumSecurity = ns.getServerMinSecurityLevel(target); //TODO: move to obj
        let maximumMoney = ns.getServerMaxMoney(target);
        let currentSecurity = ns.getServerSecurityLevel(target)
        let currentMoney = ns.getServerMoneyAvailable(target)
        ns.print(`Sec vs MinSec: ${ns.formatNumber(currentSecurity)}/${ns.formatNumber(minimumSecurity)} (+${ns.formatPercent(1 - currentSecurity/minimumSecurity)})`)
        ns.print(`Money vs MaxMoney: ${ns.formatNumber(currentMoney)}/${ns.formatNumber(maximumMoney)} (${ns.formatPercent(currentMoney/maximumMoney)})`)
    }
    return ns.getServerMaxMoney(target) == ns.getServerMoneyAvailable(target) && ns.getServerMinSecurityLevel(target) == ns.getServerSecurityLevel(target)
}

// Hardcoded for home host
async function minimizeSecurity(ns: NS, target: string, securityDifference: number) {
    ns.print(`Need ${ns.formatNumber(securityDifference)} less security`)
    // let hostRAM = getFreeRAM(ns, 'home', 0.1) //TODO: check if enough ram before running
    let weaken1Threads = Math.ceil(securityDifference / ns.weakenAnalyze(1));
    const maxThreads = getMaximumThreads(ns, HWGW_CONSTANTS.weaken1.RAM_COST, ns.getHostname(), Math.floor);
    if (weaken1Threads > maxThreads) weaken1Threads = maxThreads;
    ns.printf(`Running WEAKEN with ${weaken1Threads} threads`);
    ns.exec(HWGW_CONSTANTS.weaken1.SCRIPT_LOCATION, ns.getHostname(), {threads: weaken1Threads, temporary: true}, target)
    // let [delay, port] = [0, 0];
    // ns.exec(HGW_TYPE.WEAKEN.SCRIPT_LOCATION, ns.getHostname(), {threads: threadCount, temporary: true}, JSON.stringify({target, delay, port}))
}

// Hardcoded for home host
async function maximizeMoney(ns: NS, target: string, moneyDifference: number) {
    ns.print(`Need ${ns.formatNumber(moneyDifference)} more money`)
    // let hostRAM = getFreeRAM(ns, 'home', 0.1) //TODO: check if enough ram before running
    
    const maxMoney = ns.getServerMaxMoney(target);
    const multFactor = maxMoney / (maxMoney - moneyDifference);
    let growThreads = Math.ceil(ns.growthAnalyze(target, multFactor));

    // ns.printf(`Max: ${ns.formatNumber(maxMoney)}`)
    // ns.printf(`Missing: ${ns.formatNumber(moneyDifference)}`)
    // ns.printf(`Mult: ${ns.formatNumber(multFactor)}`)
    // ns.printf(`Should be: ${ns.formatNumber(ns.getServerMoneyAvailable(target) * multFactor)}`)
    // ns.printf(`Grow threads: ${ns.formatNumber(growThreads)}`)

    const maxThreads = getMaximumThreads(ns, HWGW_CONSTANTS.grow.RAM_COST, ns.getHostname(), Math.floor);
    if (growThreads > maxThreads) growThreads = maxThreads;
    ns.printf(`Running GROW with ${growThreads} threads`);
    ns.exec(HWGW_CONSTANTS.grow.SCRIPT_LOCATION, ns.getHostname(), {threads: growThreads, temporary: true}, target)
    // let [delay, port] = [0, 0];
    // ns.exec(HGW_TYPE.GROW.SCRIPT_LOCATION, ns.getHostname(), {threads: threadCount, temporary: true}, JSON.stringify({target, delay, port}))
}

function getWGWThreads(ns: NS, target: string): HWGW_ThreadCounts {
    const threadCounts = new HWGW_ThreadCounts();

    // weaken1 is easy, just get security decr, ceil just in case
    threadCounts.weaken1 = Math.ceil((ns.getServerSecurityLevel(target) - ns.getServerMinSecurityLevel(target)) / HWGW_CONSTANTS.weaken1.SEC_CHANGE);
    
    // grow is trickier - get multiplier, and ceil it to ensure growth
    const maxMoney = ns.getServerMaxMoney(target);
    if (ns.fileExists('formulas.exe')) {
        const so = ns.getServer(target);
        so.hackDifficulty = so.minDifficulty;
        threadCounts.grow = Math.ceil(ns.formulas.hacking.growThreads(so, ns.getPlayer(), so.moneyMax));
    } else {
        const multFactor = maxMoney / (maxMoney - (maxMoney - ns.getServerMoneyAvailable(target)));
        threadCounts.grow = Math.ceil(ns.growthAnalyze(target, multFactor));
    }
    
    // weaken2 is easy as well, just account for grow increases, ceil just in case //TODO: HMMM, why isn't this enough??
    threadCounts.weaken2 = Math.ceil((threadCounts.grow * HWGW_CONSTANTS.grow.SEC_CHANGE) / HWGW_CONSTANTS.weaken2.SEC_CHANGE);

    //print
    threadCounts.print(ns);

    return threadCounts;
}

function getGWTimes(ns: NS, target: string, verbose = false): HWGW_StartEndTimes {
    const weaken1ExecTime = ns.getServerSecurityLevel(target) == ns.getServerMinSecurityLevel(target) ? 0 : ns.getWeakenTime(target);

    let hackTime = ns.getHackTime(target);
    const growExecTime = hackTime * HWGW_CONSTANTS.grow.RELATIVE_HACK_TIME;
    const weaken2ExecTime = hackTime * HWGW_CONSTANTS.weaken1.RELATIVE_HACK_TIME;

    const BUFFER_MS = 50;

    let startEndTimes = new HWGW_StartEndTimes();

    let fullTime = Math.max(weaken1ExecTime, growExecTime, weaken2ExecTime);

    if (weaken1ExecTime > 0) { //only do weaken1
        startEndTimes.weaken1.end = fullTime;
        startEndTimes.weaken1.start = fullTime - weaken1ExecTime;
    } else { //g, w2
        //grow (ends first)
        startEndTimes.grow.end = fullTime;
        startEndTimes.grow.start = startEndTimes.grow.end - growExecTime;

        //weaken2 (ends second)
        startEndTimes.weaken2.end = fullTime + BUFFER_MS;
        startEndTimes.weaken2.start = fullTime - weaken2ExecTime;
    }

    if (verbose) startEndTimes.print(ns);

    return startEndTimes;
}

function getWGWTimes(ns: NS, target: string, growThreads?: number): HWGW_StartEndTimes {

    let weaken1ExecTime = ns.getServerSecurityLevel(target) == ns.getServerMinSecurityLevel(target) ? 0 : ns.getWeakenTime(target);
    let growExecTime: number;
    let weaken2ExecTime: number;

    if (ns.fileExists('formulas.exe')) {
        const player = ns.getPlayer();
        const so = ns.getServer(target);
        so.hackDifficulty = so.minDifficulty;
        growExecTime = ns.formulas.hacking.growTime(so, player);

        so.hackDifficulty = HWGW_CONSTANTS.grow.SEC_CHANGE * growThreads;
        weaken2ExecTime = ns.formulas.hacking.weakenTime(so, player);
    } else {
        let hackTime = ns.getHackTime(target);
        growExecTime = hackTime * HWGW_CONSTANTS.grow.RELATIVE_HACK_TIME; //will be too much b/c security up
        weaken2ExecTime = hackTime * HWGW_CONSTANTS.weaken1.RELATIVE_HACK_TIME; //will be off b/c security min then up from grow
    }

    const BUFFER_MS = 50;

    let startEndTimes = new HWGW_StartEndTimes();

    let fullTime = Math.max(weaken1ExecTime, growExecTime, weaken2ExecTime); //assuming weakens for now, will break if wrong

    //weaken1
    startEndTimes.weaken1.end = fullTime;
    startEndTimes.weaken1.start = fullTime - weaken1ExecTime;

    //grow
    startEndTimes.grow.end = fullTime + BUFFER_MS;
    startEndTimes.grow.start = startEndTimes.grow.end - growExecTime;

    //weaken2
    startEndTimes.weaken2.end = fullTime + BUFFER_MS*2;
    startEndTimes.weaken2.start = fullTime - weaken2ExecTime;

    startEndTimes.print(ns);

    return startEndTimes;

}

function getOptimalGrowWeakenThreads(ns: NS, totalPossibleThreads: number, target: string): { growThreads: number; weakenThreads: number} {
    // Constants
    const maxMoney = ns.getServerMaxMoney(target);
    const currentMoney = ns.getServerMoneyAvailable(target);
    const multFactor = maxMoney / (maxMoney - (maxMoney - currentMoney));

    // Calculate the maximum threads case, and if we have the space, do that
    const maxGrowThreads = Math.ceil(ns.growthAnalyze(target, multFactor));
    const maxWeakenThreads = Math.ceil(
        (maxGrowThreads * HWGW_CONSTANTS.grow.SEC_CHANGE) /
            HWGW_CONSTANTS.weaken2.SEC_CHANGE
    );
    const maximumNeededThreads = maxGrowThreads + maxWeakenThreads;
    ns.print(`Optimal Grow/Weaken Threads: ${maxGrowThreads} | ${maxWeakenThreads}`);
    if (maximumNeededThreads <= totalPossibleThreads) {
        return { growThreads: maxGrowThreads, weakenThreads: maxWeakenThreads };
    }

    // Binary search bounds
    let lowerBound = 0;
    let upperBound = totalPossibleThreads;

    while (lowerBound < upperBound) {
        const midpoint = Math.floor((lowerBound + upperBound) / 2);

        // Test growThreads at the midpoint
        const growThreads = midpoint;

        // Calculate weaken threads
        const weakenThreads = Math.ceil((growThreads * HWGW_CONSTANTS.grow.SEC_CHANGE) / HWGW_CONSTANTS.weaken2.SEC_CHANGE);

        // Get total threads
        const totalThreadsSimulated = growThreads + weakenThreads;

        if (totalThreadsSimulated > totalPossibleThreads) {
            // Reduce upper bound
            upperBound = midpoint; // No -1 needed for integers
        } else {
            // Increase lower bound
            lowerBound = midpoint + 1;
        }
    }

    // Lower bound is the closest valid configuration
    const growThreads = lowerBound - 1; // Correct for overreach
    const weakenThreads = Math.ceil((growThreads * HWGW_CONSTANTS.grow.SEC_CHANGE) / HWGW_CONSTANTS.weaken2.SEC_CHANGE);

    ns.print(`Calculateed Grow/Weaken Threads: ${growThreads} | ${weakenThreads}`);
    return { growThreads, weakenThreads };
}


function prepSecurity(ns: NS, target: string, network: RamNetwork, execTimes: HWGW_StartEndTimes, precalculatedThreads?: number) {
    let weakenThreads = 0;
    let weakenType = HWGW_TYPE.weaken2;
    if (precalculatedThreads) {
        //just account for grow increases, ceil just in case
        weakenThreads = precalculatedThreads;
    } else {
        //just get security decr, ceil just in case
        weakenThreads = Math.ceil((ns.getServerSecurityLevel(target) - ns.getServerMinSecurityLevel(target)) / HWGW_CONSTANTS.weaken1.SEC_CHANGE);
        weakenType = HWGW_TYPE.weaken1;
    }
    // ns.print(`Need ${weakenThreads} weaken threads!`);
    const weakenJob = new Batch_Job(HWGW_CONSTANTS[weakenType].SCRIPT_LOCATION, weakenThreads, weakenType, target, execTimes[weakenType].start, execTimes[weakenType].end);
    network.execNetworkIterative(weakenJob, weakenThreads);
}

function prepMoney(ns: NS, target: string, network: RamNetwork, growThreads: number, execTimes: HWGW_StartEndTimes[HWGW_TYPE.grow]) {

    // ns.print(`Need ${growThreads} grow threads!`);
    const growJob = new Batch_Job(HWGW_CONSTANTS[HWGW_TYPE.grow].SCRIPT_LOCATION, growThreads, HWGW_TYPE.grow, target, execTimes.start, execTimes.end);
    network.execNetworkIterative(growJob, growThreads);

    return growThreads;
}


export async function iterativePrepImproved(ns: NS, target: string): Promise<boolean> {
    rootServer(ns, target);
    let minimumSecurity = ns.getServerMinSecurityLevel(target); //TODO: move to obj
    let maximumMoney = ns.getServerMaxMoney(target);
    while (!isPrepped(ns, target)) {
        ns.printf(`\n\n---NEW ITERATION on ${target}---\n\n`);

        let currentSecurity = ns.getServerSecurityLevel(target)
        let currentMoney = ns.getServerMoneyAvailable(target)
        ns.print(`Sec vs MinSec: ${ns.formatNumber(currentSecurity)}/${ns.formatNumber(minimumSecurity)} (+${ns.formatPercent(1 - currentSecurity/minimumSecurity)})`)
        ns.print(`Money vs MaxMoney: ${ns.formatNumber(currentMoney)}/${ns.formatNumber(maximumMoney)} (${ns.formatPercent(currentMoney/maximumMoney)})`)

        let network = new RamNetwork(ns, ServerSubset.ALL);
        const maxScriptRam = Math.max(ns.getScriptRam(HWGW_CONSTANTS[HWGW_TYPE.grow].SCRIPT_LOCATION), ns.getScriptRam(HWGW_CONSTANTS[HWGW_TYPE.weaken1].SCRIPT_LOCATION),ns.getScriptRam(HWGW_CONSTANTS[HWGW_TYPE.weaken2].SCRIPT_LOCATION));
        network.updateDefaultFilterPredicateMinRam(maxScriptRam); //just in case, no blocks smaller than this
        const execTimes = getGWTimes(ns, target);
        
        //w1 //TODO: inefficient, can theoretically also do gw2, but it's only once so it's fine
        if (currentSecurity > minimumSecurity) {
            prepSecurity(ns, target, network, execTimes);
        }
        //g, w2
        else if (currentMoney < maximumMoney) {
            const totalThreads = network.getTotalThreadsPossible(HWGW_CONSTANTS[HWGW_TYPE.grow].RAM_COST); //same for grow and weaken, so it's safe to do so
            const {growThreads, weakenThreads} = getOptimalGrowWeakenThreads(ns, totalThreads, target);
            prepMoney(ns, target, network, growThreads, execTimes.grow);
            prepSecurity(ns, target, network, execTimes, weakenThreads);
        }

        //sleep
        let sleepTime = Math.max(...Object.values(execTimes).map(({ end }) => end));
        ns.printf(`Sleeping for ${ns.tFormat(sleepTime, true)}`)
        await ns.sleep(sleepTime + 100);
    }
    return Promise.resolve(true);
}

//TODO: redo using ramNet
export async function iterativePrepOld(ns: NS, target: string): Promise<boolean> {
    rootServer(ns, target);
    //TODO: need root access
    let minimumSecurity = ns.getServerMinSecurityLevel(target); //TODO: move to obj
    let maximumMoney = ns.getServerMaxMoney(target);
    
    while (!isPrepped(ns, target)) {
        ns.printf(`\n\n---NEW ITERATION on ${target}---\n\n`);

        let currentSecurity = ns.getServerSecurityLevel(target)
        let currentMoney = ns.getServerMoneyAvailable(target)
        ns.print(`Sec vs MinSec: ${ns.formatNumber(currentSecurity)}/${ns.formatNumber(minimumSecurity)} (+${ns.formatPercent(1 - currentSecurity/minimumSecurity)})`)
        ns.print(`Money vs MaxMoney: ${ns.formatNumber(currentMoney)}/${ns.formatNumber(maximumMoney)} (${ns.formatPercent(currentMoney/maximumMoney)})`)

        if (!ns.fileExists('formulas.exe')) {

            let sleepType: any; //HGW_CONSTANTS;
            //allow 10% extra security before fixing initially
            if (currentSecurity > (minimumSecurity * 1.1)) {
                sleepType = HWGW_CONSTANTS.weaken1
                await minimizeSecurity(ns, target, currentSecurity - minimumSecurity);
            }
            else if (currentMoney < maximumMoney) {
                sleepType = HWGW_CONSTANTS.grow
                await maximizeMoney(ns, target, maximumMoney - currentMoney);
            } else if (currentSecurity > minimumSecurity) {
                sleepType = HWGW_CONSTANTS.weaken1
                await minimizeSecurity(ns, target, currentSecurity - minimumSecurity);
            } else {
                break;
            }

            let sleepTimes = getHgwExecTimes(ns, target);
            let sleepTime = sleepType == HWGW_CONSTANTS.grow ? sleepTimes.grow : sleepTimes.weaken;
            ns.printf(`Sleeping for ${ns.tFormat(sleepTime, true)}`)
            await ns.sleep(sleepTime + 100);
        
        } else {

            const threads = getWGWThreads(ns, target);
            const times = getWGWTimes(ns, target, threads.grow);
            for (const hwgwType of HWGW_TYPES) { 
                if (threads[hwgwType+'Threads'] > 0) {
                    ns.exec(HWGW_CONSTANTS[hwgwType].SCRIPT_LOCATION, 'home', {threads: threads[hwgwType+'Threads'], temporary: true}, target, times[hwgwType].start, times[hwgwType].end);
                }
            }
            await ns.sleep(times.weaken2.end + 100);
        }
    }
    return Promise.resolve(true);
}

export function autocomplete(data, args) {
    return [...data.servers]; // This script autocompletes the list of servers.
}