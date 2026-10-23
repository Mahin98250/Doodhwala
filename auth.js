const PRODUCTION_ORIGIN="https://mahin98250.github.io/Doodhwala";
let mode="signin";
const form=document.getElementById("authForm"),fullName=document.getElementById("fullName"),email=document.getElementById("email"),password=document.getElementById("password"),submit=document.getElementById("submitAuth"),message=document.getElementById("authMessage"),googleAuth=document.getElementById("googleAuth"),forgotAuth=document.getElementById("forgotAuth"),phoneToggle=document.getElementById("phoneToggle"),phoneForm=document.getElementById("phoneForm"),phoneNumber=document.getElementById("phoneNumber"),sendOtp=document.getElementById("sendOtp"),verifyOtp=document.getElementById("verifyOtp"),otpCode=document.getElementById("otpCode");
const passwordResetForm=document.getElementById("passwordResetForm"),newPassword=document.getElementById("newPassword"),confirmPassword=document.getElementById("confirmPassword"),cancelPasswordReset=document.getElementById("cancelPasswordReset");
function showMessage(text,error=false){message.textContent=text;message.className="auth-message show"+(error?" error":"")}
function getReturnPath(){const value=new URLSearchParams(location.search).get("return")||"/Doodhwala/";try{const target=new URL(value,PRODUCTION_ORIGIN+"/auth.html");if(target.origin!==new URL(PRODUCTION_ORIGIN).origin||!target.pathname.startsWith("/Doodhwala/")||target.pathname==="/Doodhwala/auth.html")return "/Doodhwala/";return target.pathname+target.search+target.hash}catch(_){return "/Doodhwala/"}}
function productionUrl(path){return PRODUCTION_ORIGIN+path}
function isLocalOrigin(){return /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(location.hostname)||location.hostname.endsWith(".local")}
function productionGoogleUrl(){return productionUrl("/auth.html?oauth=google&return="+encodeURIComponent(getReturnPath()))}
if(isLocalOrigin()){location.replace(productionGoogleUrl());throw new Error("Local development origin blocked; redirecting to production.")}
function setMode(next){mode=next;document.querySelectorAll("[data-mode]").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));document.getElementById("nameField").style.display=mode==="signup"?"grid":"none";submit.textContent=mode==="signup"?"Create account →":"Sign in →";document.getElementById("authTitle").textContent=mode==="signup"?"Join Doodhwala.":"Welcome back.";document.getElementById("authIntro").textContent=mode==="signup"?"Create your customer account to order local milk and save delivery addresses.":"Sign in to save addresses, place orders and manage your milk deliveries.";forgotAuth.style.display=mode==="signin"?"block":"none"}
let phoneFormWasVisible=false;
function setPasswordResetMode(active){
 document.querySelectorAll("#authForm,.auth-tabs,#googleAuth,#forgotAuth,.auth-divider,#phoneToggle").forEach(el=>el.classList.toggle("hidden",active));
 if(active){phoneFormWasVisible=!phoneForm.classList.contains("hidden");phoneForm.classList.add("hidden")}else{phoneForm.classList.toggle("hidden",!phoneFormWasVisible);phoneFormWasVisible=false}
 passwordResetForm.classList.toggle("hidden",!active);
 if(active){
  document.getElementById("authTitle").textContent="Choose a new password.";
  document.getElementById("authIntro").textContent="Use a strong password you have not used elsewhere.";
 }else{
  newPassword.value="";
  confirmPassword.value="";
  newPassword.disabled=false;
  confirmPassword.disabled=false;
  passwordResetForm.querySelector('button[type="submit"]').disabled=false;
 }
}
function leavePasswordResetMode(){
 const url=new URL(location.href);
 url.searchParams.delete("reset");
 url.hash="";
 history.replaceState(null,"",url.pathname+url.search);
 setPasswordResetMode(false);
 setMode("signin");
}
async function checkPasswordResetRoute(){
 if(new URLSearchParams(location.search).get("reset")!=="1")return false;
 setPasswordResetMode(true);
 if(!await ensureReady())return true;
 try{
  const {data,error}=await Doodhwala.supabase.auth.getSession();
  if(error)throw error;
  if(!data?.session){
   newPassword.disabled=true;
   confirmPassword.disabled=true;
   passwordResetForm.querySelector('button[type="submit"]').disabled=true;
   showMessage("This password reset link is invalid or has expired. Use Forgot password to request a new link.",true);
  }
 }catch(err){showMessage(authError(err),true)}
 return true;
}
passwordResetForm.onsubmit=async function(e){
 e.preventDefault();
 if(!await ensureReady())return;
 const nextPassword=newPassword.value;
 if(nextPassword.length<8){showMessage("Choose a password with at least 8 characters.",true);return}
 if(nextPassword!==confirmPassword.value){showMessage("The passwords do not match.",true);return}
 const saveButton=passwordResetForm.querySelector('button[type="submit"]');
 saveButton.disabled=true;
 try{
  const {data:sessionData,error:sessionError}=await Doodhwala.supabase.auth.getSession();
  if(sessionError)throw sessionError;
  if(!sessionData?.session)throw new Error("Password reset link expired. Request a new link.");
  const {error}=await Doodhwala.supabase.auth.updateUser({password:nextPassword});
  if(error)throw error;
  try{await Doodhwala.supabase.auth.signOut()}catch(_){}
  leavePasswordResetMode();
  showMessage("Password updated successfully. Sign in using your new password.");
 }catch(err){showMessage(authError(err),true);saveButton.disabled=false}
};
cancelPasswordReset.onclick=()=>{leavePasswordResetMode();showMessage("Enter your email and choose Forgot password to request a new link.")};
function authError(err){const m=String(err?.message||err||"Authentication failed");if(/email.*rate limit|rate limit.*email|email rate.?limit|too many requests/i.test(m))return"Email sending is temporarily rate-limited by Supabase. Stop retrying for now and try again after the limit resets.";if(/password.*weak|password.*breached|compromised/i.test(m))return"Choose a stronger password that has not appeared in known data breaches.";if(/email.*not.*confirm|confirm.*email/i.test(m))return"Your account was created, but your email still needs verification. Check your inbox, then sign in.";if(/invalid login credentials/i.test(m))return"Email or password is incorrect.";if(/already registered|already been registered/i.test(m))return"An account already exists with this email. Try Sign in or reset the password.";if(/redirect.*url|not allowed/i.test(m))return"Authentication is configured, but this site's redirect URL is not allowed in Supabase.";return m}
function normalizePhone(v){const digits=v.replace(/\D/g,"");if(digits.length===10)return "+91"+digits;if(digits.length===12&&digits.startsWith("91"))return "+"+digits;return v.trim()}
async function ensureReady(){if(!window.Doodhwala?.configured){showMessage("Supabase is not configured.",true);return false}return true}
document.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
setMode("signin");
form.onsubmit=async function(e){e.preventDefault();if(!await ensureReady())return;submit.disabled=true;try{if(mode==="signup"){const name=fullName.value.trim();if(name.length<2)throw new Error("Enter your full name.");const {data,error}=await Doodhwala.supabase.auth.signUp({email:email.value.trim(),password:password.value,options:{data:{full_name:name},emailRedirectTo:productionUrl("/auth.html?return="+encodeURIComponent(getReturnPath()))}});if(error)throw error;if(data.session){showMessage("Account created. Redirecting…");await postAuthRedirect()}else showMessage("Account created. Check your email to verify it. After verification, return here and sign in.");}else{const {error}=await Doodhwala.supabase.auth.signInWithPassword({email:email.value.trim(),password:password.value});if(error)throw error;await postAuthRedirect()}}catch(err){showMessage(authError(err),true)}finally{submit.disabled=false}};
googleAuth.onclick=async()=>{if(isLocalOrigin()){showMessage("Google sign-in uses the secure production site. Opening Doodhwala…");location.href=productionGoogleUrl();return}if(!await ensureReady())return;googleAuth.disabled=true;try{const {error}=await Doodhwala.supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:productionUrl("/auth.html?return="+encodeURIComponent(getReturnPath())),queryParams:{prompt:"select_account"}}});if(error)throw error}catch(err){showMessage(authError(err),true);googleAuth.disabled=false}};
function isCustomerRoute(path){return path==="/Doodhwala/"||/\/Doodhwala\/(orders|plans|checkout|store|product)(\.html)?/.test(path)||path.includes("view=providers")||path.includes("view=saved")}
async function customerNeedsCompletion(user){const {data,error}=await Doodhwala.supabase.from("profiles").select("full_name,phone").eq("id",user.id).maybeSingle();if(error)throw error;return !data||!String(data.full_name||"").trim()||!String(data.phone||"").trim()}
function showProfileCompletion(user){document.querySelectorAll("#authForm,.auth-tabs,#googleAuth,#forgotAuth,.auth-divider,#phoneToggle,#phoneForm").forEach(el=>{if(el)el.classList.add("hidden")});const box=document.getElementById("profileCompletion");if(!box)return;box.classList.remove("hidden");const meta=user?.user_metadata||{};document.getElementById("completeFullName").value=meta.full_name||meta.name||"";document.getElementById("completePhone").value=user?.phone||"";document.getElementById("completeProfileBtn").disabled=false}
async function finishProfileCompletion(){const btn=document.getElementById("completeProfileBtn");const name=document.getElementById("completeFullName").value.trim();const phone=normalizePhone(document.getElementById("completePhone").value);const address=document.getElementById("completeAddress").value.trim();const area=document.getElementById("completeArea").value.trim();const city=document.getElementById("completeCity").value.trim();const pin=document.getElementById("completePin").value.trim();if(name.length<2){showMessage("Enter your full name.",true);return}if(!/^\+?[0-9]{10,15}$/.test(phone)){showMessage("Enter a valid phone number.",true);return}if(address||area||city||pin){if(!address||!area||!city||!/^\d{6}$/.test(pin)){showMessage("Complete the home address, area, city and 6-digit PIN, or leave the address blank.",true);return}}btn.disabled=true;btn.textContent="Saving…";try{const {error}=await Doodhwala.supabase.rpc("complete_current_customer_profile",{p_full_name:name,p_phone:phone,p_address_line:address||null,p_area_name:area||null,p_city:city||null,p_pin_code:pin||null});if(error)throw error;showMessage("Account completed. Redirecting…");location.replace(getReturnPath())}catch(err){showMessage(authError(err),true);btn.disabled=false;btn.textContent="Save & Continue →"}}
document.getElementById("profileCompletionForm")?.addEventListener("submit",e=>{e.preventDefault();finishProfileCompletion()});
async function postAuthRedirect(){const returnPath=getReturnPath();const {data}=await Doodhwala.supabase.auth.getSession();const user=data?.session?.user;if(!user){location.replace(returnPath);return}const {data:isAdmin}=await Doodhwala.supabase.rpc("is_current_user_admin");if(isAdmin===true){showMessage("Admin account verified. Opening Admin Panel…");location.replace("/Doodhwala/admin.html");return}if(isCustomerRoute(returnPath)&&await customerNeedsCompletion(user)){showProfileCompletion(user);return}showMessage("Signed in. Redirecting…");location.replace(returnPath)}
async function handleExistingSession(){if(new URLSearchParams(location.search).get("reset")==="1")return;if(!window.Doodhwala?.configured)return;if(new URLSearchParams(location.search).get("oauth")==="google")return;try{const {data}=await Doodhwala.supabase.auth.getSession();const session=data?.session;if(!session?.user)return;await postAuthRedirect()}catch(err){console.warn("Existing session check failed",err)}}
checkPasswordResetRoute();
handleExistingSession();
const autoGoogle=new URLSearchParams(location.search).get("oauth")==="google";if(autoGoogle&&!isLocalOrigin())setTimeout(()=>googleAuth.click(),80);
forgotAuth.onclick=async()=>{if(!await ensureReady())return;const e=email.value.trim();if(!e){showMessage("Enter your email first, then tap Forgot password.",true);return}try{const {error}=await Doodhwala.supabase.auth.resetPasswordForEmail(e,{redirectTo:productionUrl("/auth.html?reset=1&return="+encodeURIComponent(getReturnPath()))});if(error)throw error;showMessage("Password reset email sent. Check your inbox")}catch(err){showMessage(authError(err),true)}};
phoneToggle.onclick=()=>{phoneForm.classList.toggle("hidden");phoneToggle.textContent=phoneForm.classList.contains("hidden")?"Use phone + OTP":"Hide phone + OTP"};
phoneForm.onsubmit=async e=>{e.preventDefault();if(!await ensureReady())return;sendOtp.disabled=true;try{const {error}=await Doodhwala.supabase.auth.signInWithOtp({phone:normalizePhone(phoneNumber.value)});if(error)throw error;showMessage("OTP requested. This requires phone authentication/SMS to be enabled in Supabase.");document.getElementById("otpField").classList.remove("hidden");verifyOtp.classList.remove("hidden")}catch(err){showMessage("Phone OTP is not enabled yet. Configure a phone/SMS provider in Supabase Auth first.",true)}finally{sendOtp.disabled=false}};
verifyOtp.onclick=async()=>{try{const {data,error}=await Doodhwala.supabase.auth.verifyOtp({phone:normalizePhone(phoneNumber.value),token:otpCode.value.trim(),type:"sms"});if(error)throw error;if(data.session)await postAuthRedirect()}catch(err){showMessage(authError(err),true)}};