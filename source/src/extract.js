const fs=require('fs');
const src=fs.readFileSync(__dirname+'/data_block.js','utf8');
const f=new Function(src+';return {VOCAB,NATURE,CONJ,CORE_THEMES,ADVANCED_THEMES,VERB_PRESENT,GRAMMAR_CATEGORIES};');
const d=f();
console.log(Object.keys(d.VOCAB).length,'themes', d.CONJ.length,'conj', d.GRAMMAR_CATEGORIES.map(c=>c.name+':'+c.items.length).join(' | '));
console.log(Object.keys(d.VOCAB).join(' ; '));
fs.writeFileSync(__dirname+'/full_data.json', JSON.stringify(d));
