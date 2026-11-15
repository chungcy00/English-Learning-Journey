import assert from 'node:assert/strict';
import { test } from 'node:test';
import { familyConnectorPaths } from './familyTreeConnections';

const parent = {left:100,top:0,width:100,height:56};
const children = [{left:0,top:104,width:100,height:56},{left:200,top:104,width:100,height:56}];
const numbers = (path: string) => path.match(/-?\d+(?:\.\d+)?/g)!.map(Number);

test('desktop branches share an exact junction and terminate at each node outline', () => {
 const paths = familyConnectorPaths(parent,children,false).map(numbers);
 const junction = paths[0].slice(-2);
 assert.deepEqual(paths[0].slice(0,2),[150,54]);
 assert.deepEqual(paths[1].slice(0,2),junction);
 assert.deepEqual(paths[2].slice(0,2),junction);
 assert.deepEqual(paths[1].slice(-2),[50,106]);
 assert.deepEqual(paths[2].slice(-2),[250,106]);
});

test('a single branch stays connected through explicit right-angle corners', () => {
 const paths = familyConnectorPaths(parent,[children[0]],false);
 assert.equal(paths.length,1);
 assert.deepEqual(numbers(paths[0]).slice(0,2),[150,54]);
 assert.deepEqual(numbers(paths[0]).slice(-2),[50,106]);
 assert.deepEqual(familyConnectorPaths(parent,[],false),[]);
});

test('stacked branches meet the same continuous trunk at every child center', () => {
 const narrowParent = {left:0,top:0,width:104,height:56};
 const narrowChildren = [{left:32,top:66,width:110,height:56},{left:32,top:132,width:110,height:72}];
 const paths = familyConnectorPaths(narrowParent,narrowChildren,true).map(numbers);
 assert.deepEqual(paths[0].slice(0,2),[16,54]);
 assert.deepEqual(paths[0].slice(-2),paths[1].slice(0,2));
 assert.deepEqual(paths[0].slice(-2),paths[2].slice(0,2));
 assert.deepEqual(paths[2].slice(-2),paths[3].slice(0,2));
 assert.deepEqual(paths[1].slice(-2),[34,94]);
 assert.deepEqual(paths[3].slice(-2),[34,168]);
});

test('hand-drawn strokes contain uneven intermediate bends and remain stable between renders', () => {
 const paths = familyConnectorPaths(parent,children,false);
 for (const path of paths) assert.ok((path.match(/C /g) || []).length >= 5);
 assert.deepEqual(familyConnectorPaths(parent,children,false),paths);
});


test('desktop branches turn at exact right angles with axis-aligned tangents', () => {
 const paths = familyConnectorPaths(parent,children,false);
 for (const [index,path] of paths.slice(1).entries()) {
  const commands = path.match(/C [^C]+/g)!.map(numbers);
  const cornerX = children[index].left + children[index].width / 2;
  const cornerY = 75.84;
  const cornerIndex = commands.findIndex(command => command[4] === cornerX && command[5] === cornerY);
  assert.ok(cornerIndex >= 0, 'The path must visit the right-angle corner');
  const incoming = commands[cornerIndex];
  const outgoing = commands[cornerIndex + 1];
  assert.equal(incoming[3],cornerY, 'The incoming tangent stays horizontal');
  assert.equal(outgoing[0],cornerX, 'The outgoing tangent stays vertical');
 }
});
