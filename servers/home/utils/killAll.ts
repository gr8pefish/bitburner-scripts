import { getAllServers } from "../core/coreUtils";


//takes in a list of targets
export async function main(ns: NS) {
    const removeHome = ns.args[0] as boolean || true;
    getAllServers(ns, removeHome).forEach(server => {
        ns.killall(server);
    });
}

export function autocomplete(data, args) {
    return [false, true];
}