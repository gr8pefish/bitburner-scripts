import React, {useState} from 'react';

export async function main(ns: NS) {
  ns.tprint('Hello World!');
  ns.printRaw(TestElement({ns}));
}

type Props = {
  ns: NS
}

function TestElement({ns}: Props) {
  // const [count, setCount] = useState(0);
  return React.createElement('button',{onClick: () => ns.tprint("hi")}, "click me");
  // return <div>Count {count} <button onClick={() => setCount(count + 1)}>Add to count</button></div>;
}