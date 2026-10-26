'use strict';
// Windows-compatible source synchronization. Credential is accepted only on hidden stdin.
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..');
const fail=message=>{throw new Error(message);};
let credential;
function git(args,network=false,allowFailure=false){
 const env={...process.env,GIT_TERMINAL_PROMPT:'0'};
 const auth=[];
 if(network){for(const key of Object.keys(env))if(key.startsWith('GIT_TRACE')||key==='GIT_CURL_VERBOSE')delete env[key];const quote=value=>"'"+value.replace(/'/g,"'\\''")+"'";env.GIT_CONFIG_PARAMETERS=['credential.helper=','http.extraHeader=','http.followRedirects=false','http.'+credential.remote_url+'.extraHeader=Authorization: Bearer '+credential.token].map(quote).join(' ');}
 const result=spawnSync('git',[...auth,...args],{cwd:root,env,encoding:'utf8',windowsHide:true});
 if(result.error)fail('Could not start Git.');
 if(result.status!==0&&!allowFailure)fail((result.stderr||'Git operation failed').split(credential.token).join('[redacted]').trim());
 return result;
}
async function main(){
 process.stderr.write('Ready for Site workflow JSON on stdin (input is hidden).\n');
 const input=await new Promise((resolve,reject)=>{let value='';const tty=process.stdin.isTTY;if(tty)process.stdin.setRawMode(true);process.stdin.setEncoding('utf8');const finish=()=>{if(tty)process.stdin.setRawMode(false);process.stdin.pause();resolve(value);};process.stdin.on('data',chunk=>{value+=chunk;if(value.includes('\u0003'))return reject(new Error('Cancelled'));if(value.length>65536)return reject(new Error('Input too large'));if(/[\r\n]/.test(value))finish();});process.stdin.on('end',finish);});
 const request=JSON.parse(input);credential=request.credential;
 if(credential?.auth_mode!=='http_extra_header'||!credential.token||/[\r\n\0]/.test(credential.token))fail('Invalid source credential.');
 const url=new URL(credential.remote_url);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)fail('Invalid source URL.');
 if(Date.parse(credential.token_expires_at)<=Date.now())fail('Source credential expired.');
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'.openai/hosting.json'),'utf8'));
 if(manifest.project_id!==request.project_id)fail('Project identity mismatch.');
 git(['check-ref-format','--branch',credential.branch]);
 if(!fs.existsSync(path.join(root,'.git'))){git(['init','.']);git(['symbolic-ref','HEAD','refs/heads/'+credential.branch]);}
 if(path.resolve(git(['rev-parse','--show-toplevel']).stdout.trim())!==root)fail('Repository must belong to this project directory.');
 const advertised=git(['ls-remote','--heads',credential.remote_url,'refs/heads/'+credential.branch],true).stdout.trim().split(/\s/)[0];
 const before=git(['rev-parse','--verify','HEAD'],false,true).stdout.trim();
 if(advertised&&advertised!==before)fail('Remote source changed; preserve both histories before publishing.');
 git(['add','--all']);
 if(git(['diff','--cached','--quiet'],false,true).status!==0)git(['-c','user.name=SpecFlow','-c','user.email=specflow@users.noreply.openai.com','commit','-m','Build SpecFlow technical proposal workspace']);
 const sha=git(['rev-parse','HEAD']).stdout.trim();
 git(['push',credential.remote_url,'HEAD:refs/heads/'+credential.branch],true);
 if(git(['ls-remote','--heads',credential.remote_url,'refs/heads/'+credential.branch],true).stdout.trim().split(/\s/)[0]!==sha)fail('Could not verify pushed source.');
 if(git(['status','--porcelain']).stdout.trim())fail('Source changed after commit.');
 console.log(JSON.stringify({project_id:manifest.project_id,commit_sha:sha,checkout_path:root}));
}
main().catch(error=>{console.error(credential?.token?String(error.message).split(credential.token).join('[redacted]'):error.message);process.exitCode=1;});