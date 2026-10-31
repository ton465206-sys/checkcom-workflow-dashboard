export const marketingTools=[
 ['draft-content','ຮ່າງ Content','Blog, Social, Landing page'],
 ['campaign-plan','ວາງແຜນ Campaign','ເປົ້າໝາຍ, ກຸ່ມລູກຄ້າ, ປະຕິທິນ'],
 ['brand-review','ກວດ Brand','ນ້ຳສຽງ, ຂໍ້ຄວາມ, ຫຼັກຖານ'],
 ['competitive-brief','ວິເຄາະຄູ່ແຂ່ງ','ແຫຼ່ງຂໍ້ມູນ ແລະຈຸດຕ່າງ'],
 ['performance-report','ລາຍງານການຕະຫຼາດ','Leads, CPL/CAC, ROAS'],
 ['seo-audit','ກວດ SEO','Keyword, Content, Technical SEO'],
 ['email-sequence','ຮ່າງຊຸດ Email','Nurture, Follow-up, CTA']
];
export function marketingBrief({command,goal,audience,product,owner='',due=''}){
 if(!marketingTools.some(t=>t[0]===command))throw Error('Unknown marketing workflow.');
 if(!String(goal||'').trim()||!String(audience||'').trim())throw Error('ກະລຸນາລະບຸເປົ້າໝາຍ ແລະກຸ່ມລູກຄ້າ');
 if(due&&(!/^\d{4}-\d{2}-\d{2}$/.test(due)||new Date(due+'T00:00:00Z').toISOString().slice(0,10)!==due))throw Error('Invalid date.');
 return `ບອສ ໃຫ້ຝ່າຍ Marketing ໃຊ້ ${command}\nສິນຄ້າ/ບໍລິການ: ${product||'ລໍຖ້າຢືນຢັນ'}\nເປົ້າໝາຍ: ${goal.trim()}\nກຸ່ມລູກຄ້າ: ${audience.trim()}\nຜູ້ຮັບຜິດຊອບ: ${owner||'ຍັງບໍ່ລະບຸ'}\nວັນຕິດຕາມ: ${due||'ຍັງບໍ່ລະບຸ'}\nໃຊ້ຄູ່ມື Marketing ຕາມຊື່ວຽກນີ້ ແລະຂໍ້ມູນ Mongmee ກ່ອນ. ຈັດເປັນຮ່າງໃຫ້ກວດ, ແຍກຂໍ້ເທັດຈິງອອກຈາກສົມມຸດຖານ. ຂາດງົບ/ໄລຍະເວລາ/ຂໍ້ມູນໃຫ້ລະບຸຊັດ. ບໍ່ສົ່ງຫາລູກຄ້າ, ບໍ່ເຜີຍແຜ່ ຫຼືໃຊ້ງົບໂຄສະນາ ຈົນກວ່າທ່ານອະນຸມັດ.`;
}
