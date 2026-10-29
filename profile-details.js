(()=> {
  "use strict";
  const $=id=>document.getElementById(id);
  const client=()=>window.Doodhwala?.supabase||null;
  const form=$("personalDetailsForm");
  const save=$("saveProfile");
  const message=$("formMessage");
  const retryLoad=$("retryLoadDetails");
  const addressToggle=$("editAddress");
  const addressFields=$("addressFields");
  let currentUser=null;
  let latestAuthTransition=null;
  let redirectingToSignIn=false;

  function showMessage(text,kind="info"){
    message.textContent=text;
    message.dataset.kind=kind;
  }
  function setAddressEditing(enabled){
    addressFields.disabled=!enabled;
    for(const id of ["addressLine","areaName","city","pinCode"]) $(id).required=enabled;
  }
  function setProfileFieldsEnabled(enabled){
    for(const id of ["fullName","phone","editAddress"]) $(id).disabled=!enabled;
    if(!enabled) addressFields.disabled=true;
    else setAddressEditing(addressToggle.checked);
  }
  function normalizePhone(value){return String(value||"").trim().replace(/[\s()-]/g,"");}
  function safeError(error){
    const text=String(error?.message||"");
    if(/authentication_required|jwt expired|invalid jwt|session/i.test(text)) return "Your session has expired. Please sign in again.";
    if(/full_name_required/i.test(text)) return "Enter your full name (at least 2 characters).";
    if(/invalid_phone/i.test(text)) return "Enter a valid phone number using 10–15 digits.";
    if(/complete_address_required|invalid_pin/i.test(text)) return "Complete the address, area, city and 6-digit PIN code.";
    if(/failed to fetch|network|timeout|fetch/i.test(text)) return "We couldn't connect. Check your connection and try again.";
    return "We couldn't save your details. Please try again.";
  }
  function redirectToSignIn(){
    if(redirectingToSignIn) return;
    redirectingToSignIn=true;
    currentUser=null;
    setProfileFieldsEnabled(false);
    retryLoad.hidden=true;
    retryLoad.disabled=true;
    save.disabled=true;
    save.textContent="Redirecting…";
    for(const id of ["fullName","phone","addressLine","areaName","city","pinCode"]){
      const field=$(id);
      if(field) field.value="";
    }
    $("accountEmail").textContent="Your session changed. Please sign in again.";
    showMessage("Your session changed. Please sign in again.","error");
    const returnPath=location.pathname+location.search+location.hash;
    location.replace("/Doodhwala/auth/?return="+encodeURIComponent(returnPath));
  }
  function watchAuthState(){
    const sup=client();
    if(!sup?.auth||typeof sup.auth.onAuthStateChange!=="function") return;
    sup.auth.onAuthStateChange((event,session)=>{
      const nextUser=session?.user||null;
      if(event!=="INITIAL_SESSION") latestAuthTransition={event,userId:nextUser?.id||null};
      if(currentUser&&currentUser.id!==nextUser?.id) redirectToSignIn();
    });
  }
  async function loadDetails(){
    const sup=client();
    if(!sup){
      showMessage("Secure account service is unavailable. Check your connection, then retry.","error");
      $("accountEmail").textContent="Account connection unavailable";
      retryLoad.hidden=false;
      retryLoad.disabled=false;
      save.disabled=true;
      return;
    }
    retryLoad.hidden=true;
    retryLoad.disabled=true;
    save.disabled=true;
    setProfileFieldsEnabled(false);
    showMessage("Checking your sign-in…");
    try{
      const {data:sessionData,error:sessionError}=await sup.auth.getSession();
      if(sessionError) throw sessionError;
      currentUser=sessionData?.session?.user||null;
      if(latestAuthTransition&&latestAuthTransition.userId!==(currentUser?.id||null)){
        redirectToSignIn();return;
      }
      if(!currentUser){redirectToSignIn();return;}
      $("accountEmail").textContent=currentUser.email||currentUser.phone||"Signed in to your Doodhwala account";

      const {data:profile,error:profileError}=await sup.from("profiles")
        .select("full_name,phone")
        .eq("id",currentUser.id)
        .maybeSingle();
      if(profileError) throw profileError;
      if(redirectingToSignIn) return;

      $("fullName").value=profile?.full_name||currentUser.user_metadata?.full_name||currentUser.user_metadata?.name||"";
      $("phone").value=profile?.phone||currentUser.phone||"";

      const {data:address,error:addressError}=await sup.from("addresses")
        .select("recipient_name,phone,address_line,area_name,city,pin_code")
        .eq("user_id",currentUser.id)
        .eq("is_default",true)
        .order("created_at",{ascending:true})
        .limit(1)
        .maybeSingle();
      if(addressError) throw addressError;
      if(redirectingToSignIn) return;
      if(address){
        $("addressLine").value=address.address_line||"";
        $("areaName").value=address.area_name||"";
        $("city").value=address.city||"";
        $("pinCode").value=address.pin_code||"";
      }
      setAddressEditing(false);
      setProfileFieldsEnabled(true);
      showMessage("Your saved details are loaded. Make your changes, then save.","info");
      save.disabled=false;
    }catch(error){
      if(redirectingToSignIn) return;
      showMessage(safeError(error),"error");
      retryLoad.hidden=false;
      retryLoad.disabled=false;
      save.disabled=true;
    }
  }

  retryLoad.addEventListener("click",()=>{
    if(retryLoad.disabled)return;
    loadDetails();
  });

  addressToggle.addEventListener("change",()=>{
    setAddressEditing(addressToggle.checked);
    showMessage(addressToggle.checked
      ?"Complete all address fields to save your default delivery address."
      :"Your saved default address will be left unchanged.","info");
  });

  form.addEventListener("submit",async event=>{
    event.preventDefault();
    if(redirectingToSignIn)return;
    if(!currentUser){redirectToSignIn();return;}
    if(save.disabled)return;
    const fullName=$("fullName").value.trim();
    const phone=normalizePhone($("phone").value);
    if(fullName.length<2||fullName.length>120){
      showMessage("Enter your full name (2–120 characters).","error");$("fullName").focus();return;
    }
    if(!/^\+?[0-9]{10,15}$/.test(phone)){
      showMessage("Enter a valid phone number using 10–15 digits, with an optional leading +.","error");$("phone").focus();return;
    }
    let addressLine=null,areaName=null,city=null,pinCode=null;
    if(addressToggle.checked){
      addressLine=$("addressLine").value.trim();
      areaName=$("areaName").value.trim();
      city=$("city").value.trim();
      pinCode=$("pinCode").value.trim();
      if(!addressLine||!areaName||!city||!/^[0-9]{6}$/.test(pinCode)){
        showMessage("Complete the address, area, city and 6-digit PIN code, or turn off address editing to keep it unchanged.","error");return;
      }
    }
    const sup=client();
    if(!sup){showMessage("Secure account service is unavailable. Please refresh and try again.","error");return;}
    save.disabled=true;
    save.textContent="Saving…";
    showMessage("Saving your changes securely…");
    try{
      const {data:latestSession,error:latestSessionError}=await sup.auth.getSession();
      if(latestSessionError) throw latestSessionError;
      if(redirectingToSignIn) return;
      const latestUser=latestSession?.session?.user||null;
      if(!latestUser||latestUser.id!==currentUser.id){
        redirectToSignIn();return;
      }
      const {error}=await sup.rpc("complete_current_customer_profile",{
        p_full_name:fullName,
        p_phone:phone,
        p_address_line:addressLine,
        p_area_name:areaName,
        p_city:city,
        p_pin_code:pinCode
      });
      if(error) throw error;
      showMessage("Personal details saved to your account.","success");
      $("accountEmail").textContent=currentUser.email||currentUser.phone||"Signed in to your Doodhwala account";
      if(addressToggle.checked) setAddressEditing(false);
    }catch(error){
      if(/authentication_required|jwt expired|invalid jwt|session/i.test(String(error?.message||""))){
        redirectToSignIn();return;
      }
      if(!redirectingToSignIn) showMessage(safeError(error),"error");
    }finally{
      save.disabled=redirectingToSignIn;
      save.textContent=redirectingToSignIn?"Redirecting…":"Save personal details";
    }
  });

  watchAuthState();
  loadDetails();
})();
