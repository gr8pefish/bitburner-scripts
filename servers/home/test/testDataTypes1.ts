import { SHARE_SCRIPT_LOCATION, XP_SCRIPT_LOCATION } from "../core/constants";
import { disableLog, freeRamPredicate, RamNetwork } from "../core/coreUtils";
import { Job, ServerSubset } from "../core/datatypes";



export async function main(ns: NS) {
    disableLog(ns);
    ns.tail();

    const script = SHARE_SCRIPT_LOCATION;
    const threads = 1;
    const ramCost = ns.getScriptRam(script) * threads;
    const ramnet = new RamNetwork(ns, ServerSubset.NOT_OWNED, freeRamPredicate(ramCost));
    ramnet.print();
    await ramnet.execNetworkMultiple([new Job(script, threads), new Job(script, threads), new Job(script, threads), new Job(script, threads*4)], {verbose: true})
    ramnet.print(); //TODO: doesn't quite update right

    
    // ramnet.execNetwork(new Job(script, threads), {verbose: true});
    // ramnet.execNetwork(new Job(script, 4), {verbose: true});

    // const scriptTest = '/dist/shareTest.js'
    // ns.printf('SCRIPT '+ns.formatRam(ns.getScriptRam(scriptTest)));
    // ns.printf('USED '+ns.formatRam(ns.getServerUsedRam('nectar-net')));
    // ns.printf('MAX '+ns.formatRam(ns.getServerMaxRam('nectar-net')));
    // ns.exec(scriptTest, 'nectar-net', 4);
    // ramnet.execNetwork(new Job(script, 1));
    // ramnet.execNetwork(new Job(script, 16));

    // RamNetwork.initRamNetwork(ns);

    // RamNetwork.execScript(ns, SHARE_SCRIPT_LOCATION, 2, ServerSubset.ALL, {verbose: true}); //TODO: not sorted correctly, but otherwise good?!

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