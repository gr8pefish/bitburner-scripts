import { SHARE_SCRIPT_LOCATION, XP_SCRIPT_LOCATION } from "../core/constants";
import { disableLog, RamNetwork } from "../core/coreUtils";
import { ServerSubset } from "../core/datatypes";



export async function main(ns: NS) {
    disableLog(ns); ns.tail();
    RamNetwork.initRamNetwork(ns);
    RamNetwork.execScript(ns, SHARE_SCRIPT_LOCATION, 2, ServerSubset.ALL, {verbose: true}); //TODO: not sorted correctly, but otherwise good?!

    // Add servers to the network
    // RamNetwork.addServer(ns, "server1");
    // RamNetwork.exec(ns, `/dist/xp.js`, 'home', 1, false);

    // RamNetwork.execMultiple(ns, XP_SCRIPT_LOCATION, ServerSubset.OTHERS_ONLY, {partial: false});

    // network.upsert({ serverName: "Server1", freeRam: 1024 });
    // network.upsert({ serverName: "Server2", freeRam: 600 });
    // network.upsert({ serverName: "Server3", freeRam: 768 });
    // network.upsert({ serverName: "Server4", freeRam: 256 });
    
    // // Retrieve 3 servers, each requiring 300 freeRam
    // const requiredServers = network.getServersWithDynamicUpdateOptimized(3, 300);
    // console.log("First call required servers:", requiredServers);
    
    // // Check remaining servers in the network
    // console.log("Remaining servers:", network.getAllServers());
    

}