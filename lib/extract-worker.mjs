import { extract } from './documents.mjs';
process.once('message', async ({ data, name }) => {
  try { process.send({ result: await extract(Buffer.from(data, 'base64'), name) }); }
  catch (error) { process.send({ error: error.message }); }
});
