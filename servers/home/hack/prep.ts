import { HWGW_CONSTANTS } from "../core/constants";
import { prepAllServers, getFreeRAM, rootServer } from "../core/coreUtils";
import { getHgwExecTimes } from "./hackUtils";

//TODO: redo basically, w/ protobatcher help/datatypes

export async function main(ns: NS) {
    ns.clearLog(); 
    // ns.disableLog('ALL'); ns.enableLog('printf'); 
    ns.tail()
    prepAllServers(ns);
    let target = ns.args[0] as string
    await iterativePrep(ns, target)
    ns.printf("SUCCESS Prepped!");
}

export function isPrepped(ns:NS, target: string, print = false): boolean {
    if (print) {
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
    const weaken1Threads = Math.ceil(securityDifference / ns.weakenAnalyze(1));
    ns.exec(HWGW_CONSTANTS.weaken1.SCRIPT_LOCATION, ns.getHostname(), {threads: weaken1Threads, temporary: true}, target)
    // let [delay, port] = [0, 0];
    // ns.exec(HGW_TYPE.WEAKEN.SCRIPT_LOCATION, ns.getHostname(), {threads: threadCount, temporary: true}, JSON.stringify({target, delay, port}))
}

// Hardcoded for home host
async function maximizeMoney(ns: NS, target: string, moneyDifference: number) {
    ns.print(`Need ${ns.formatNumber(moneyDifference)} more money`)
    // let hostRAM = getFreeRAM(ns, 'home', 0.1) //TODO: check if enough ram before running
    
    //wait it is right?
    const maxMoney = ns.getServerMaxMoney(target);
    const multFactor = maxMoney / moneyDifference;
    const growThreads = Math.ceil(ns.growthAnalyze(target, multFactor));
    // ns.printf(`${ns.formatNumber(maxMoney)}`)
    // ns.printf(`${ns.formatNumber(moneyDifference)}`)
    // ns.printf(`${ns.formatNumber(multFactor)}`)
    // ns.printf(`${ns.formatNumber(growThreads)}`)

    ns.exec(HWGW_CONSTANTS.grow.SCRIPT_LOCATION, ns.getHostname(), {threads: growThreads, temporary: true}, target)
    // let [delay, port] = [0, 0];
    // ns.exec(HGW_TYPE.GROW.SCRIPT_LOCATION, ns.getHostname(), {threads: threadCount, temporary: true}, JSON.stringify({target, delay, port}))
}

async function iterativePrep(ns: NS, target: string): Promise<boolean> {
    rootServer(ns, target);
    //TODO: need root access
    let minimumSecurity = ns.getServerMinSecurityLevel(target); //TODO: move to obj
    let maximumMoney = ns.getServerMaxMoney(target);
    
    while (!isPrepped(ns, target)) {
        ns.printf(`\n\n---NEW ITERATION---\n\n`);

        let currentSecurity = ns.getServerSecurityLevel(target)
        let currentMoney = ns.getServerMoneyAvailable(target)
        ns.print(`Sec vs MinSec: ${ns.formatNumber(currentSecurity)}/${ns.formatNumber(minimumSecurity)} (+${ns.formatPercent(1 - currentSecurity/minimumSecurity)})`)
        ns.print(`Money vs MaxMoney: ${ns.formatNumber(currentMoney)}/${ns.formatNumber(maximumMoney)} (${ns.formatPercent(currentMoney/maximumMoney)})`)

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
        let sleepTime = sleepType == HWGW_CONSTANTS.grow ? sleepTimes.GrowTime : sleepTimes.WeakenTime;
        ns.printf(`Sleeping for ${ns.tFormat(sleepTime, true)}`)
        await ns.sleep(sleepTime + 100);
    }
    return Promise.resolve(true);
}

export function autocomplete(data, args) {
    return [...data.servers]; // This script autocompletes the list of servers.
}