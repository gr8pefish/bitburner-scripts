import { SHARE_SCRIPT_LOCATION } from "../core/constants";

//takes in a list of targets
export async function main(ns: NS) {
    
    let threadTotal = 0;
    const previousSharePower = ns.getSharePower();

    for (let arg of ns.args) {
        const target = arg as string;
        const threads = Math.floor(ns.getServerMaxRam(target) / ns.getScriptRam(SHARE_SCRIPT_LOCATION));
        ns.exec(SHARE_SCRIPT_LOCATION, target, threads);
        threadTotal += threads;
    }
    await ns.sleep(20);
    const newSharePower = ns.getSharePower();
    ns.tprint(`Added ${threadTotal} share threads! (Share power ${ns.formatNumber(previousSharePower)} -> ${ns.formatNumber(newSharePower)})`);
}

export function autocomplete(data, args) {
    return [...data.servers]; // This script autocompletes the list of servers.
}