export async function main(ns: NS) {
    const target = ns.args[0] as string;
    const delay = ns.args[1] as number || 0;
    await ns.weaken(target, {additionalMsec: delay});
    // const [target, delay, port] = JSON.parse(ns.args[0] as any);
    // await ns.weaken(target, {additionalMsec: delay} )
    // ns.writePort(port, await ns.hack(target, { additionalMsec: delay }));
}