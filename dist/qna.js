const QNA_STORAGE_KEY='ssbs-news-qna-demo-v1';
const QNA_OWNER_KEY='ssbs-news-qna-owner-v1';

function getOwnerId(){
  let ownerId=localStorage.getItem(QNA_OWNER_KEY);
  if(!ownerId){ownerId=crypto.randomUUID();localStorage.setItem(QNA_OWNER_KEY,ownerId)}
  return ownerId;
}

const currentOwnerId=getOwnerId();

function loadQuestions(){
  try{return JSON.parse(localStorage.getItem(QNA_STORAGE_KEY))||[]}
  catch{return []}
}

function saveQuestions(questions){
  localStorage.setItem(QNA_STORAGE_KEY,JSON.stringify(questions));
}

function claimLegacyComments(){
  const questions=loadQuestions();let changed=false;
  questions.forEach(question=>{
    if(!question.ownerId){question.ownerId=currentOwnerId;changed=true}
    question.replies.forEach(reply=>{if(!reply.ownerId){reply.ownerId=currentOwnerId;changed=true}});
  });
  if(changed)saveQuestions(questions);
}

function selectedAuthor(form,prefix){
  const mode=form.querySelector(`input[name="${prefix}-identity"]:checked`).value;
  if(mode==='anonymous') return '匿名用户';
  const input=form.querySelector(`#${prefix}-name`);
  return input.value.trim()||'未署名用户';
}

function formatTime(timestamp){
  return new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(timestamp));
}

function makeMeta(author,time){
  const meta=document.createElement('div');meta.className='comment-meta';
  const name=document.createElement('strong');name.textContent=author;
  const date=document.createElement('span');date.textContent=formatTime(time);
  meta.append(name,date);return meta;
}

function makeDeleteButton(label,onDelete){
  const button=document.createElement('button');button.type='button';button.className='comment-delete';button.textContent=label;
  button.addEventListener('click',()=>{if(confirm('确定要删除吗？'))onDelete()});
  return button;
}

function buildIdentityControls(prefix){
  const row=document.createElement('div');row.className='identity-row';
  const title=document.createElement('span');title.textContent='回复方式';
  const anonymous=document.createElement('label');anonymous.innerHTML=`<input type="radio" name="${prefix}-identity" value="anonymous" checked> 匿名`;
  const named=document.createElement('label');named.innerHTML=`<input type="radio" name="${prefix}-identity" value="named"> 实名`;
  const name=document.createElement('input');name.type='text';name.id=`${prefix}-name`;name.className='name-input';name.placeholder='请输入姓名';name.maxLength=30;name.hidden=true;
  row.append(title,anonymous,named,name);
  row.addEventListener('change',()=>{name.hidden=row.querySelector('input:checked').value!=='named';if(!name.hidden)name.focus()});
  return row;
}

function renderQuestions(){
  const list=document.getElementById('qna-list');const questions=loadQuestions();list.replaceChildren();
  if(!questions.length){const empty=document.createElement('p');empty.className='qna-empty';empty.textContent='还没有问题，来提出第一个问题吧。';list.append(empty);return}
  questions.slice().reverse().forEach(question=>{
    const item=document.createElement('article');item.className='question';item.append(makeMeta(question.author,question.time));
    const text=document.createElement('p');text.className='comment-text';text.textContent=question.text;item.append(text);
    const actions=document.createElement('div');actions.className='comment-actions';
    const toggle=document.createElement('button');toggle.type='button';toggle.className='reply-toggle';toggle.textContent=`回复${question.replies.length?` · ${question.replies.length}条`:''}`;actions.append(toggle);
    if(question.ownerId===currentOwnerId)actions.append(makeDeleteButton('删除问题',()=>{const all=loadQuestions().filter(entry=>entry.id!==question.id);saveQuestions(all);renderQuestions()}));
    item.append(actions);
    const replies=document.createElement('div');replies.className='replies';
    question.replies.forEach(reply=>{const block=document.createElement('div');block.className='reply';block.append(makeMeta(reply.author,reply.time));const replyText=document.createElement('p');replyText.className='comment-text';replyText.textContent=reply.text;block.append(replyText);if(reply.ownerId===currentOwnerId)block.append(makeDeleteButton('删除回复',()=>{const all=loadQuestions();const target=all.find(entry=>entry.id===question.id);target.replies=target.replies.filter(entry=>entry.id!==reply.id);saveQuestions(all);renderQuestions()}));replies.append(block)});item.append(replies);
    const form=document.createElement('form');form.className='reply-form';form.hidden=true;
    const area=document.createElement('textarea');area.rows=3;area.maxLength=500;area.required=true;area.placeholder='写下你的回复……';
    const prefix=`reply-${question.id}`;form.append(area,buildIdentityControls(prefix));const submit=document.createElement('button');submit.type='submit';submit.textContent='发表回复';form.append(submit);item.append(form);
    toggle.addEventListener('click',()=>{form.hidden=!form.hidden;if(!form.hidden)area.focus()});
    form.addEventListener('submit',event=>{event.preventDefault();const all=loadQuestions();const target=all.find(entry=>entry.id===question.id);target.replies.push({id:crypto.randomUUID(),ownerId:currentOwnerId,text:area.value.trim(),author:selectedAuthor(form,prefix),time:Date.now()});saveQuestions(all);renderQuestions()});
    list.append(item);
  });
}

const questionForm=document.getElementById('question-form');
questionForm.addEventListener('change',event=>{if(event.target.name==='question-identity'){const input=document.getElementById('question-name');input.hidden=event.target.value!=='named';if(!input.hidden)input.focus()}});
questionForm.addEventListener('submit',event=>{event.preventDefault();const area=document.getElementById('question-text');const questions=loadQuestions();questions.push({id:crypto.randomUUID(),ownerId:currentOwnerId,text:area.value.trim(),author:selectedAuthor(questionForm,'question'),time:Date.now(),replies:[]});saveQuestions(questions);questionForm.reset();document.getElementById('question-name').hidden=true;renderQuestions()});
claimLegacyComments();
renderQuestions();
