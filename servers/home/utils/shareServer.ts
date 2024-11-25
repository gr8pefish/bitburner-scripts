import { SHARE_SCRIPT_LOCATION } from "../core/constants";
import { getAllServers, getMaximumThreads } from "../core/coreUtils";

//takes in a list of targets, or 'ALL' for all non-home server
export async function main(ns: NS) {
    
    let threadTotal = 0;
    const previousSharePower = ns.getSharePower();

    for (let arg of ns.args) {
        if (arg == 'ALL') {
            getAllServers(ns, true).forEach(host => {
                const threads = getMaximumThreads(ns, SHARE_SCRIPT_LOCATION, host, Math.floor)
                if (threads > 0) ns.exec(SHARE_SCRIPT_LOCATION, host, threads);
                threadTotal += threads;
            });
            break;
        } else {
            const target = arg as string;
            const threads = getMaximumThreads(ns, SHARE_SCRIPT_LOCATION, target, Math.floor)
            ns.exec(SHARE_SCRIPT_LOCATION, target, threads);
            threadTotal += threads;
        }
    }
    await ns.sleep(20);
    const newSharePower = ns.getSharePower();
    ns.tprint(`Added ${threadTotal} share threads! (Share power ${ns.formatNumber(previousSharePower)} -> ${ns.formatNumber(newSharePower)})`);
}

export function autocomplete(data, args) {
    return [...data.servers]; // This script autocompletes the list of servers.
}