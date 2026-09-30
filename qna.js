const SUPABASE_URL='https://almnmqlszuvzjuyizxwm.supabase.co';
const SUPABASE_KEY='sb_publishable_zCQqD_DX9ueJwvSCHITxnw_sbUwSvJI';
const COMMENTS_ENDPOINT=`${SUPABASE_URL}/rest/v1/qna_comments`;
const OWNER_KEY='ssbs-news-qna-owner-v1';
const OWNED_IDS_KEY='ssbs-news-qna-owned-ids-v1';

function getOwnerToken(){
  let token=localStorage.getItem(OWNER_KEY);
  if(!token){token=crypto.randomUUID();localStorage.setItem(OWNER_KEY,token)}
  return token;
}

const ownerToken=getOwnerToken();

function apiHeaders(extra={}){
  return {'apikey':SUPABASE_KEY,'Content-Type':'application/json','x-owner-token':ownerToken,...extra};
}

function getOwnedIds(){
  try{return new Set(JSON.parse(localStorage.getItem(OWNED_IDS_KEY))||[])}catch{return new Set()}
}

function rememberOwnedId(id){
  const ids=getOwnedIds();ids.add(id);localStorage.setItem(OWNED_IDS_KEY,JSON.stringify([...ids]));
}

function forgetOwnedId(id){
  const ids=getOwnedIds();ids.delete(id);localStorage.setItem(OWNED_IDS_KEY,JSON.stringify([...ids]));
}

async function request(url,options={}){
  const response=await fetch(url,{...options,headers:apiHeaders(options.headers)});
  if(!response.ok){const message=await response.text();throw new Error(message||`请求失败（${response.status}）`)}
  if(response.status===204)return null;
  const text=await response.text();return text?JSON.parse(text):null;
}

async function loadComments(){
  return request(`${COMMENTS_ENDPOINT}?select=id,parent_id,content,author,created_at&order=created_at.asc`);
}

function selectedAuthor(form,prefix){
  const mode=form.querySelector(`input[name="${prefix}-identity"]:checked`).value;
  if(mode==='anonymous')return '匿名用户';
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

function makeDeleteButton(label,id,onDeleted){
  const button=document.createElement('button');button.type='button';button.className='comment-delete';button.textContent=label;
  button.addEventListener('click',async()=>{
    if(!confirm('确定要删除吗？'))return;
    button.disabled=true;
    try{await request(`${COMMENTS_ENDPOINT}?id=eq.${encodeURIComponent(id)}`,{method:'DELETE'});forgetOwnedId(id);await onDeleted()}
    catch(error){alert(`删除失败：${error.message}`);button.disabled=false}
  });
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

async function renderQuestions(){
  const list=document.getElementById('qna-list');
  list.innerHTML='<p class="qna-empty">正在加载公共评论……</p>';
  try{
    const comments=await loadComments();const ownedIds=getOwnedIds();list.replaceChildren();
    const questions=comments.filter(comment=>!comment.parent_id).reverse();
    if(!questions.length){const empty=document.createElement('p');empty.className='qna-empty';empty.textContent='还没有问题，来提出第一个问题吧。';list.append(empty);return}
    questions.forEach(question=>{
      const questionReplies=comments.filter(comment=>comment.parent_id===question.id);
      const item=document.createElement('article');item.className='question';item.append(makeMeta(question.author,question.created_at));
      const text=document.createElement('p');text.className='comment-text';text.textContent=question.content;item.append(text);
      const actions=document.createElement('div');actions.className='comment-actions';
      const toggle=document.createElement('button');toggle.type='button';toggle.className='reply-toggle';toggle.textContent=`回复${questionReplies.length?` · ${questionReplies.length}条`:''}`;actions.append(toggle);
      if(ownedIds.has(question.id))actions.append(makeDeleteButton('删除问题',question.id,renderQuestions));
      item.append(actions);
      const replies=document.createElement('div');replies.className='replies';
      questionReplies.forEach(reply=>{
        const block=document.createElement('div');block.className='reply';block.append(makeMeta(reply.author,reply.created_at));
        const replyText=document.createElement('p');replyText.className='comment-text';replyText.textContent=reply.content;block.append(replyText);
        if(ownedIds.has(reply.id))block.append(makeDeleteButton('删除回复',reply.id,renderQuestions));replies.append(block);
      });
      item.append(replies);
      const form=document.createElement('form');form.className='reply-form';form.hidden=true;
      const area=document.createElement('textarea');area.rows=3;area.maxLength=500;area.required=true;area.placeholder='写下你的回复……';
      const prefix=`reply-${question.id}`;form.append(area,buildIdentityControls(prefix));
      const submit=document.createElement('button');submit.type='submit';submit.textContent='发表回复';form.append(submit);item.append(form);
      toggle.addEventListener('click',()=>{form.hidden=!form.hidden;if(!form.hidden)area.focus()});
      form.addEventListener('submit',async event=>{
        event.preventDefault();submit.disabled=true;submit.textContent='发表中……';
        try{
          const [created]=await request(COMMENTS_ENDPOINT,{method:'POST',headers:{'Prefer':'return=representation'},body:JSON.stringify({parent_id:question.id,content:area.value.trim(),author:selectedAuthor(form,prefix),owner_token:ownerToken})});
          rememberOwnedId(created.id);await renderQuestions();
        }catch(error){alert(`发表失败：${error.message}`);submit.disabled=false;submit.textContent='发表回复'}
      });
      list.append(item);
    });
  }catch(error){list.innerHTML='<p class="qna-empty">公共评论加载失败，请稍后重试。</p>';console.error(error)}
}

const questionForm=document.getElementById('question-form');
questionForm.addEventListener('change',event=>{if(event.target.name==='question-identity'){const input=document.getElementById('question-name');input.hidden=event.target.value!=='named';if(!input.hidden)input.focus()}});
questionForm.addEventListener('submit',async event=>{
  event.preventDefault();const area=document.getElementById('question-text');const submit=questionForm.querySelector('button[type="submit"]');submit.disabled=true;submit.textContent='发表中……';
  try{
    const [created]=await request(COMMENTS_ENDPOINT,{method:'POST',headers:{'Prefer':'return=representation'},body:JSON.stringify({parent_id:null,content:area.value.trim(),author:selectedAuthor(questionForm,'question'),owner_token:ownerToken})});
    rememberOwnedId(created.id);questionForm.reset();document.getElementById('question-name').hidden=true;await renderQuestions();
  }catch(error){alert(`发表失败：${error.message}`)}
  finally{submit.disabled=false;submit.textContent='发表问题'}
});

document.getElementById('qna-refresh').addEventListener('click',renderQuestions);
renderQuestions();
