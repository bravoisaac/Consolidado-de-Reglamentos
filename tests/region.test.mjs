import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { cropRectangle } = createRequire(import.meta.url)('../desktop/region-geometry.cjs');

test('recorta con escala 150% y monitor de origen negativo', () => {
  assert.deepEqual(cropRectangle({x:100,y:50,width:300,height:200},{x:-1280,y:-200,width:1280,height:720},{width:1920,height:1080}),{x:150,y:75,width:450,height:300});
});
test('usa la resolución efectiva de la captura y conserva límites fraccionarios', () => {
  assert.deepEqual(cropRectangle({x:10.4,y:20.4,width:100.2,height:80.1},{width:1000,height:800},{width:1250,height:1000}),{x:13,y:25,width:126,height:101});
});
test('limita la selección a un monitor sin leer píxeles fuera de sus límites', () => {
  assert.deepEqual(cropRectangle({x:980,y:750,width:100,height:100},{width:1000,height:800},{width:2000,height:1600}),{x:1960,y:1500,width:40,height:100});
});
test('rechaza coordenadas inválidas, rectángulos pequeños y cambios de pantalla', () => {
  const bounds={width:1000,height:800}, image={width:1000,height:800};
  for (const rect of [{x:NaN,y:0,width:50,height:50},{x:-1,y:0,width:50,height:50},{x:1000,y:0,width:50,height:50},{x:0,y:0,width:Infinity,height:50},{x:0,y:0,width:5,height:50},{x:0,y:0,width:50,height:-1}]) assert.throws(()=>cropRectangle(rect,bounds,image));
  assert.throws(()=>cropRectangle({x:0,y:0,width:50,height:50},bounds,{width:1000,height:500}));
});
