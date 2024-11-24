export async function main(ns: NS) {
    const target = ns.args[0] as string;
    const delay = ns.args[1] as number || 0;
    await ns.hack(target, {additionalMsec: delay});
}