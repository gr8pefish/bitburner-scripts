import { XP_SCRIPT_LOCATION } from "../core/constants";
import { getAllServers } from "../core/coreUtils";

//takes in a list of targets
export async function main(ns: NS) {
    const removeHome = ns.args[0] as boolean || true;
    getAllServers(ns, removeHome).forEach(server => {
        ns.exec(XP_SCRIPT_LOCATION, server);
    });
}