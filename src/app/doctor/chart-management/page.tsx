
'use client';
import { useState } from 'react';

export default function Intake() {
  const [step,setStep]=useState(1);
  const [form,setForm]=useState({
    drug_allergies:null,
    drug_allergies_detail:'',
    recent_surgeries:null,
    recent_surgeries_detail:'',
    medical_issues:null,
    medical_issues_detail:'',
    visit_mode:'',
    appointment_datetime:'',
    pharmacy:'',
    full_name:'',
    dob:'',
    address:'',
    phone:'',
    email:''
  });

  function update(k,v){ setForm(p=>({...p,[k]:v})); }
  function next(){ setStep(step+1); }
  function back(){ setStep(step-1); }

  async function submit(){
    const r=await fetch('/api/intake/submit',{method:'POST',body:JSON.stringify(form)}).then(r=>r.json());
    const s=await fetch('/api/stripe/create-checkout',{method:'POST',body:JSON.stringify({email:form.email,intakeId:r.intakeId})}).then(r=>r.json());
    window.location=s.url;
  }

  return (
    <div>
      <div dangerouslySetInnerHTML={{ __html: `<?php
// Your PHP code can go here if needed
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Medazon Concierge — Private Access</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

    <script>
document.addEventListener('DOMContentLoaded', function() {
  var s = document.createElement('script');
  s.src = "https://js.stripe.com/v3/";
  s.defer = true;
  document.body.appendChild(s);
});
</script>

    <!-- ✅ JSON-LD Structured Data -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "MedicalService",
  "name": "Medazon Virtual Visit",
  "description": "Private, secure telehealth visits — instant or scheduled — with licensed U.S. providers. Flat $189 if approved.",
  "areaServed": "US",
  "availableService": {
    "@type": "Service",
    "serviceType": "Telemedicine Consultation"
  },
  "provider": {
    "@type": "MedicalBusiness",
    "name": "Medazon Health LLC",
    "url": "https://medazonhealth.com",
    "telephone": "+1-480-613-6527",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "2200 E Camelback Rd",
      "addressLocality": "Phoenix",
      "addressRegion": "AZ",
      "postalCode": "85016",
      "addressCountry": "US"
    },
    "openingHours": "Mo-Fr 09:00-18:00",
    "areaServed": "US",
    "geo": {
      "@type": "GeoShape",
      "circle": "33.5085 -112.0296 1000.0" 
    }
  },
  "offers": {
    "@type": "Offer",
    "price": "189.00",
    "priceCurrency": "USD",
    "url": "https://medazonhealth.com/private/new_checkout.php"
  }
}
"priceRange": "$189 - Flat Rate",
"image": "https://medazonhealth.com/assets/og-medazon.jpg"

</script>

</script>


    <style>
        :root {
            --mint: #00DDB0;
            --bright orange: #ff7a00;
            --dark1: #0B0F12;
            --dark2: #141B1E;
            --text-light: #F5F7FA;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Inter', sans-serif;
            color: var(--text-light);
            background: var(--dark1);
            overflow-x: hidden;
        }

       /* === Hero background (optimized for image) === */
.hero {
  min-height: auto !important;      /* remove forced full screen height */
  height: auto !important;
  padding-bottom: 40px !important;  /* just enough breathing room */
  margin-bottom: 0 !important;
  background-attachment: scroll !important; /* prevents scroll-gap on Safari/Chrome */
}


.hero::before {
  content: "";
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 0;
}

        .veil, .grad { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; }
        .veil { background: rgba(0, 0, 0, .5); }
        .grad { background: linear-gradient(135deg, rgba(11, 15, 18, 0.75), rgba(20, 27, 30, 0.85)); }

        
        

        /* === Text === */
        .hero h1 {
  font-family: 'Playfair Display', serif;
  font-size: 2.5rem;
  line-height: 1.3;
  font-weight: 700;
  color: #ffffff;
  text-shadow:
    0 0 6px rgba(0, 221, 176, 0.6),
    0 0 12px rgba(0, 221, 176, 0.45),
    0 0 24px rgba(0, 221, 176, 0.25);
  margin-bottom: 1rem;
}


        /* === Buttons === */
        .cta-group { margin-bottom: 2rem; }
        .btn {
            text-decoration: none; margin: 0 .5rem; padding: 1rem 2rem; border-radius: 10px;
            font-weight: 600; transition: all .4s ease; display: inline-block;
        }
        .btn.primary {
            background: rgba(0, 221, 176, 0.25); border: 1px solid var(--mint); color: var(--text-light); backdrop-filter: blur(10px);
        }
        .btn.primary:hover { box-shadow: 0 0 25px rgba(0, 221, 176, 0.7); }
        .btn.secondary {
            border: 1px solid var(--orange); color: var(--orange); background: rgba(255, 255, 255, 0.1);
        }
        .btn.secondary:hover { box-shadow: 0 0 15px rgba(192, 198, 202, 0.6); }

        /* === Doctor Card === */
        .doctor-card { margin-top: 1rem; text-align: center; }
        .doctor-card img {
            width: 150px; height: 150px; border-radius: 50%; object-fit: cover;
            border: 3px solid var(--mint); box-shadow: 0 0 25px rgba(0, 221, 176, .3);
        }
        .doctor-card h2 { margin-top: .8rem; font-size: 1.1rem; font-weight: 600; }
        .doctor-card p { font-size: .95rem; color: #bfc3c6; }
        .doctor-card em { display: block; margin-top: .3rem; font-style: italic; color: #9ea1a3; font-size: .9rem; }

        /* === Availability Timer === */
        .availability {
            margin-top: 1rem; display: flex; justify-content: center; align-items: center;
            gap: .6rem; font-size: .95rem; color: #C0C6CA; background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1); padding: .5rem 1rem; border-radius: 30px;
            width: fit-content; margin-inline: auto; box-shadow: 0 0 10px rgba(0, 221, 176, .3);
        }
        .dot { width: 10px; height: 10px; border-radius: 50%; background: #ff4040; animation: pulse 2s infinite; }
       
        /* === Badges === */
        .badges { margin-top: 1.5rem; display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap; }
        .badge {
            border: 1px solid rgba(255, 255, 255, .1); border-radius: 20px; padding: .5rem 1.2rem;
            background: rgba(255, 255, 255, .05); box-shadow: 0 0 10px rgba(0, 221, 176, .3); transition: all .4s ease;
        }
        .badge:hover { box-shadow: 0 0 15px rgba(0, 221, 176, .8); }
/* === Override: Book for Later (Orange Theme) === */
.btn.secondary {
  border: 1px solid #ff7a00 !important;
  background-color: #ff7a00 !important;
  color: #ffffff !important;
  box-shadow: 0 0 15px rgba(255, 122, 0, 0.4) !important;
}

.btn.secondary:hover {
  background-color: #ff9933 !important;
  border-color: #ff9933 !important;
  box-shadow: 0 0 20px rgba(255, 153, 51, 0.6) !important;
  color: #fff !important;
}

        /* === Scroll cue === */
        .scroll-cue { margin-top: 1.5rem; font-size: 1rem; animation: float 2s ease-in-out infinite; }
        
        /* === Fold 2 === */
        #fold2 { background: #0f141b; padding: 60px 16px; color: #fff; text-align: center; }
        .fold2-title {
            font-size: 1.7rem; font-weight: 700; background: linear-gradient(90deg, #00ddaf, #2ee6be);
            -webkit-background-clip: text; color: transparent; margin: 40px 0 10px;
        }
        .fold2-sub { color: rgba(255, 255, 255, .7); font-size: .95rem; margin-bottom: 30px; line-height: 1.4; }
        .six-grid { display: grid; grid-template-columns: repeat(3, 1fr); grid-auto-rows: 140px; gap: 10px; margin-bottom: 60px; }
        .svc-card {
            position: relative; border-radius: 12px; overflow: hidden; background-size: cover; background-position: center;
            border: 1px solid rgba(255, 255, 255, .1); transition: transform .0s, box-shadow .0s;
        }
        .svc-card:hover { transform: scale(1.04); box-shadow: 0 0 20px #00e5be55; }
        .svc-overlay {
            position: absolute; inset: 0; background: rgba(0, 0, 0, .55);
            display: flex; flex-direction: column; align-items: center; justify-content: center;
        }
        .svc-overlay h3 { font-size: 1rem; margin: 0; text-shadow: 0 0 6px #00e5be66; }
        .svc-overlay span { font-size: .75rem; color: #00e5be; margin-top: 4px; }
        .how-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 60px; }
        .how-step {
            background: rgba(255, 255, 255, .04); border: 1px solid rgba(255, 255, 255, .1);
            border-radius: 14px; padding: 18px; transition: transform .0s, box-shadow .0s;
        }
        .how-step:hover { transform: translateY(-4px); box-shadow: 0 0 15px #00e5be55; }
        .how-step img { width: 42px; margin-bottom: 10px; filter: invert(1) brightness(1.6); }
        .how-step p { font-size: .85rem; color: rgba(255, 255, 255, .8); }
        .visit-type-grid { display: grid; grid-template-columns: repeat(0, 1fr); gap: 14px; }
        .visit-card {
            position: relative; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255, 255, 255, .1);
            transition: transform .0s;
        }
        .visit-card:hover { transform: scale(1.03); }
        .visit-card img, .visit-card video { width: 100%; height: 220px; object-fit: cover; filter: brightness(.85); }
        .visit-overlay {
            position: absolute; inset: 0; background: rgba(0, 0, 0, .55);
            display: flex; flex-direction: column; align-items: center; justify-content: center;
        }
        .visit-overlay h3 { margin: 0; font-size: 1.05rem; text-shadow: 0 0 6px #00e5be66; }
        .visit-overlay p { font-size: .85rem; color: #00e5be; margin-top: 6px; }
        .optional { font-weight: 400; font-size: .8rem; color: #ccc; }
        .cta-row { display: flex; justify-content: center; flex-wrap: wrap; gap: 16px; margin-top: 36px; }
        .cta-primary, .cta-secondary {
            min-width: 240px; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 1rem; transition: all .0s ease;
        }
        .cta-primary {
            background: linear-gradient(90deg, #006f5f, #00ddaf); color: #fff; border: 1px solid #00ddaf; box-shadow: 0 0 10px #00e5be55;
        }
        .cta-primary:hover { background: linear-gradient(90deg, #00ddaf, #2ee6be); transform: translateY(-2px); }
        .cta-secondary {
            background: transparent; color: #fff; border: 1px solid rgba(255, 255, 255, .5);
        }
        .cta-secondary:hover { border-color: #00e5be; color: #00e5be; transform: translateY(-2px); }
        @media (max-width: 768px) {
            .six-grid { grid-template-columns: repeat(0, 1fr); }
            .visit-type-grid { grid-template-columns: 1fr; gap: 16px; }
        }
        @media (max-width: 600px) { .six-grid { grid-template-columns: 1fr; } }
/* ---- Mobile Optimizations for Services Grid ---- */
@media (max-width:768px){
  .six-grid, .svc-grid, .visit-type-grid {
    display:flex;
    flex-wrap:wrap;
    justify-content:center;
    gap:10px;
  }
  .svc-card, .visit-card {
    flex:0 0 48%;
    min-width:160px;
    height:180px;
    overflow:hidden;
    border-radius:10px;
  }
  .svc-card img, .visit-card img {
    width:100%;
    height:100%;
    object-fit:cover;
    transition:none;
    transform:none !important; /* prevents zoom flicker */
  }
}

/* Disable hover zoom on touch devices */
@media{
  .svc-card:hover img,
  .visit-card:hover img {
    transform:scale(1.05);
    transition:transform .0s ease;
  }
}

        /* === Fold 3 === */
        #fold3 {
            background: #0f141b; padding: 70px 20px; color: #fff; text-align: center;
            border-top: 1px solid rgba(255, 255, 255, .08);
        }
        .fold3-title {
            font-size: 1.8rem; font-weight: 700; background: linear-gradient(90deg, #00ddaf, #2ee6be);
            -webkit-background-clip: text; color: transparent; margin-bottom: 14px;
        }
        .fold3-lead {
            color: rgba(255, 255, 255, .75); font-size: .95rem; max-width: 640px; margin: 0 auto 28px; line-height: 1.5;
        }
        .cta-tertiary {
            background: rgba(255, 255, 255, .08); color: #00e5be; border: 1px solid rgba(255, 255, 255, .15);
        }
        .cta-tertiary:hover { background: rgba(255, 255, 255, .15); transform: translateY(-2px); }
        .faq-grid { max-width: 720px; margin: 0 auto 40px; text-align: left; }
        .faq-item { border-bottom: 1px solid rgba(255, 255, 255, .1); padding: 14px 0; }
        .faq-question {
            background: none; border: none; width: 100%; text-align: left; color: #00e5be; font-weight: 600; font-size: 1rem;
            display: flex; justify-content: space-between; align-items: center; cursor: pointer; padding: 8px 0;
        }
        .faq-question::after { content: "+"; transition: transform .3s; }
        .faq-item.active .faq-question::after { content: "–"; }
        .faq-answer { max-height: 0; overflow: hidden; transition: max-height .4s ease; padding-left: 4px; }
        .faq-item.active .faq-answer { max-height: 300px; margin-top: 6px; }
        .faq-answer p { color: rgba(255, 255, 255, .75); font-size: .9rem; line-height: 1.45; margin: 0; }
        .seo-footer {
            margin: 50px auto 10px; max-width: 800px; color: rgba(255, 255, 255, .5); font-size: .8rem; line-height: 1.5;
        }

        /* === Footer === */
        #footer {
            background: #0a0f14; color: #fff; text-align: center; padding: 60px 16px 30px;
            border-top: 1px solid rgba(255, 255, 255, .08); backdrop-filter: blur(10px);
        }
        .footer-cta { display: flex; justify-content: center; flex-wrap: wrap; gap: 14px; margin-bottom: 30px; }
        .footer-brand .brand { font-size: 1.4rem; font-weight: 700; margin: 4px 0; color: #00e5be; }
        .footer-brand .tagline { color: rgba(255, 255, 255, .6); font-size: .9rem; margin-bottom: 16px; }
        .compliance-links { display: flex; flex-wrap: wrap; justify-content: center; gap: 14px; margin-bottom: 20px; }
        .compliance-links a { color: rgba(255, 255, 255, .6); font-size: .85rem; text-decoration: none; }
        .compliance-links a:hover { color: #00e5be; }
        .contact-social { margin-bottom: 20px; }
        .contact-social a { color: #00e5be; text-decoration: none; font-size: .9rem; }
        .social a { margin: 0 6px; font-size: 1.1rem; color: rgba(255, 255, 255, .7); }
        .social a:hover { color: #00e5be; }
        .legal { font-size: .8rem; color: rgba(255, 255, 255, .5); line-height: 1.5; max-width: 700px; margin: auto; }

        /* === Modal Styles === */
        .modal {
            display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.8); z-index: 1000; justify-content: center; align-items: center;
        }
        .modal-content {
            background: rgba(15, 20, 27, .7); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, .1);
            max-width: 480px; width: 90%; border-radius: 20px; padding: 24px; box-shadow: 0 0 20px #00e5be33;
            position: relative; max-height: 80vh; overflow-y: auto;
        }
        .modal-header {
            background: linear-gradient(90deg, #00ddaf, #2ee6be); color: #0f141b; font-weight: 600;
            padding: 16px; text-align: center; border-radius: 10px 10px 0 0; position: sticky; top: 0; z-index: 10;
        }
        .modal-close {
            position: absolute; right: 16px; top: 16px; background: none; border: none; color: #0f141b;
            font-size: 20px; cursor: pointer;
        }
        .modal-main { padding: 16px; }
        .modal-main h2 { font-size: 20px; text-align: center; margin-bottom: 12px; }
        .modal-main .q-item { margin-bottom: 12px; }
        .modal-main label { display: block; margin-bottom: 4px; color: #00e5be; }
        .modal-main input, .modal-main textarea {
            width: 100%; padding: 12px 14px; border-radius: 10px; border: 1px solid rgba(255, 255, 255, .15);
            background: rgba(255, 255, 255, .06); color: #fff; font-size: 15px;
        }
        .modal-main input:focus { border-color: #00e5be; box-shadow: 0 0 8px #00e5be99 inset; }
        .reason-pill {
            padding: 10px 18px; border: none; border-radius: 50px; background: rgba(255, 255, 255, .08);
            color: #fff; margin-right: 8px; cursor: pointer;
        }
        .reason-pill.active { background: linear-gradient(90deg, #00ddaf, #2ee6be); color: #0f141b; }
        .cta-fixed {
            width: 100%; height: 56px; border: none; border-radius: 12px;
            background: linear-gradient(90deg, #00ddaf, #2ee6be); color: #0f141b; font-weight: 600; font-size: 16px;
            box-shadow: 0 0 12px #00e5be66; margin-top: 20px;
        }
        .error-text { color: #ff6b6b; font-size: 13px; text-align: center; }
        .amount { font-size: 40px; color: #00e5be; text-align: center; margin: 10px 0; }
        #payment-message { color: #ff6b6b; margin-top: 8px; text-align: center; }
        .reassure { color: #00e5beaa; font-size: 13px; text-align: center; margin-top: 8px; }
        #step2, #step3 { display: none; }
        #step3 { padding: 0; }

        /* === Responsive === */
        @media (max-width: 768px) {
            h1 { font-size: 1.7rem; }
            .btn { display: block; margin: .5rem auto; }
            .doctor-card img { width: 120px; height: 120px; }
            .availability { font-size: .85rem; padding: .4rem .8rem; }
            .modal-content { width: 95%; }
        }
        /* ---- Disable all hover transforms site-wide ---- */
@media (hover:hover){
  *:hover {
    transform: none !important;
    filter: none !important;
    box-shadow: none !important;
    transition: none !important;
  }
}
/* --- Master mobile override (place at the very end of CSS) --- */
@media (max-width: 768px) {
  *,
  *::before,
  *::after {
    transition: none !important;
    animation: none !important;
    transform: none !important;
  }
  html, body {
    position: relative !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
    transform: none !important;
    -webkit-overflow-scrolling: touch !important;
  }
}
/* --- Fix hidden hero header on mobile --- */
/* --- Mobile hero visibility & spacing fix --- */
@media (max-width:768px){
  .hero {
  min-height: auto !important;      /* remove forced full screen height */
  height: auto !important;
  padding-bottom: 40px !important;  /* just enough breathing room */
  margin-bottom: 0 !important;
  background-attachment: scroll !important; /* prevents scroll-gap on Safari/Chrome */
}


  .hero-content{
    transform:none !important;
    margin-top:0 !important;
    position:relative;
    z-index:5 !important;
  }

  .video-bg,
  .video-fill{
    height:100%;
    min-height:100%;
  }
}

/* --- Hero Section tweaks --- */
.hero {
  position: relative;
  height: auto;
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 80px 16px 40px;
  background: transparent;
}

.hero-content {
  position: relative;
  z-index: 3;
  max-width: 900px;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  padding: 3rem 2rem;
  box-shadow: 0 0 40px rgba(0, 229, 190, 0.35);
}

.pricing-info {
  margin-top: 1.8rem;
  text-align: center;
}

.pricing-info h3 {
  font-size: 1.65rem;
  font-weight: 700;
  color: #00e5be;
  margin: 0;
}

.pricing-info .pricing-sub {
  margin-top: 0.4rem;
  color: #00e5be;
  font-weight: 600;
  font-size: 1rem;
}

/* --- Doctor profile (moved under hero) --- */
.doctor-profile {
  text-align: center;
  padding: 40px 16px 10px;
}

.doctor-profile img {
  width: 140px;
  height: 140px;
  border-radius: 50%;
  border: 3px solid #00e5be;
  box-shadow: 0 0 20px rgba(0, 229, 190, 0.45);
}

.doctor-profile h2 {
  margin: 12px 0 4px;
  font-size: 1.1rem;
  font-weight: 700;
  color: #fff;
}

.doctor-profile p {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.9rem;
  margin: 0;
}

/* --- Mobile adjustments --- */
@media (max-width: 768px) {
  .hero {
    padding: 60px 10px 30px;
  }
  .pricing-info h3 {
    font-size: 1.3rem;
  }
  .pricing-info .pricing-sub {
    font-size: 0.9rem;
  }
  .doctor-profile {
    padding: 30px 0 10px;
  }
}
/* --- tighten spacing between doctor profile and services --- */
.doctor-profile {
  padding: 20px 0 5px !important;   /* reduce top and bottom padding */
  margin-bottom: 10px !important;   /* closes the gap before "My Services" */
}

.doctor-profile img {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  border: 2px solid #00e5be;
  box-shadow: 0 0 12px rgba(0, 229, 190, 0.4);
}

#fold2 {
  margin-top: 0 !important;         /* ensures services section hugs the profile */
  padding-top: 20px;                /* keeps a little breathing room */
}

/* optional: slight shrink for mobile */
@media (max-width:768px){
  .doctor-profile{
    padding: 10px 0 0 !important;
    margin-bottom: 5px !important;
  }
  #fold2{
    padding-top: 15px;
  }
}
.doctor-profile .states {
  margin-top: 6px;
  font-size: 0.9rem;
  color: #00e5be;                  /* mint green */
  font-weight: 500;
  letter-spacing: 1px;
}

.doctor-profile .states strong {
  color: #00ffcc;                  /* brighter mint for emphasis */
}
/* --- How It Works Section --- */
#how-it-works {
  background: transparent;
  text-align: center;
  padding: 60px 20px 40px;
}

#how-it-works .fold2-title {
  font-size: 1.8rem;
  font-weight: 700;
  background: linear-gradient(90deg, #00ddaf, #2ee6be);
  -webkit-background-clip: text;
  color: transparent;
  margin-bottom: 50px;
}

.how-steps {
  /* --- Center the icons inside each step --- */
.step {
  display: flex;
  flex-direction: column;
  align-items: center;    /* centers the icon horizontally */
  justify-content: flex-start;
  text-align: center;
}


/* --- Always-lit mint icons --- */
.step img {
  width: 50px;
  height: 50px;
  margin-bottom: 12px;
  display: block;

  /* solid mint color + full glow */
  filter:
    invert(86%) sepia(66%) saturate(3750%) hue-rotate(125deg) brightness(110%) contrast(105%)
    drop-shadow(0 0 4px rgba(0, 229, 190, 1))
    drop-shadow(0 0 10px rgba(0, 229, 190, .9))
    drop-shadow(0 0 18px rgba(0, 229, 190, .6));
}

/* no change on hover — stays lit */
.step:hover img {
  filter:
    invert(86%) sepia(66%) saturate(3750%) hue-rotate(125deg) brightness(110%) contrast(105%)
    drop-shadow(0 0 4px rgba(0, 229, 190, 1))
    drop-shadow(0 0 10px rgba(0, 229, 190, .9))
    drop-shadow(0 0 18px rgba(0, 229, 190, .6));
}

}
/* --- Add vertical spacing between steps --- */
.how-steps {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px; /* adjust this number for more or less space */
}
/* --- Tighten spacing before How It Works --- */
.doctor-profile {
  margin-bottom: 0 !important;     /* remove excess gap below doctor card */
  padding-bottom: 10px !important; /* leave a little breathing room */
}

#how-it-works {
  margin-top: 0 !important;        /* remove any inherited top margin */
  padding-top: 20px !important;    /* light spacing for balance */
}
.doctor-profile {
  margin-bottom: 24px !important;  /* reduced from ~100px */
}

#how-it-works {
  margin-top: 0 !important;
  padding-top: 24px !important;
  padding-bottom: 28px;            /* extra separation before next section */
}

#trust-section, /* or whatever ID follows */
.trust-section {
  margin-top: 28px;
}
/* === Tell Us Your Symptoms Section === */
.symptoms-section {
  background: #0f141b;
  padding: 60px 20px 40px;
  text-align: center;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.symptoms-inner {
  max-width: 680px;
  margin: 0 auto;
}

.symptoms-title {
  font-size: 1.6rem;
  font-weight: 700;
  background: linear-gradient(90deg, #00ddaf, #2ee6be);
  -webkit-background-clip: text;
  color: transparent;
  margin-bottom: 10px;
}

.symptoms-desc {
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 22px;
  font-size: 0.95rem;
}

.symptoms-label {
  display: block;
  font-weight: 600;
  color: #fff;
  margin-bottom: 8px;
}

#symptoms-input {
  width: 100%;
  max-width: 420px;
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
}

#symptoms-input:focus {
  border-color: #00e5be;
  box-shadow: 0 0 8px rgba(0, 229, 190, 0.6);
}

/* mobile tweaks */
@media (max-width: 768px) {
  .symptoms-section {
    padding: 40px 16px 30px;
  }
  #symptoms-input {
    width: 90%;
  }
}
/* ---------- SMART SEARCH ---------- */
.suggestions{
  list-style:none;
  margin:4px 0 0;
  padding:0;
  background:#fff;
  border-radius:6px;
  box-shadow:0 2px 6px rgba(0,0,0,.15);
  position:absolute;
  width:100%;
  max-width:420px;
  z-index:20;
}
.suggestions li{padding:8px 12px;cursor:pointer;}
.suggestions li:hover{background:#00ddb0;color:#fff;}
#visitButtons{
  margin-top:10px;
  text-align:center;
}
#visitButtons button{
  margin:6px 8px 0 0;
  padding:8px 16px;
  border:none;
  border-radius:6px;
  background:#00ddb0;
  color:#0b0f12;
  font-weight:600;
  cursor:pointer;
}
#visitButtons button:hover{background:#0ef1c3;}
/* === SMART SEARCH FIELD & DROPDOWN (Medazon Theme) === */

/* Input field styling */
#symptomSearch {
  width: 100%;
  max-width: 420px;
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid rgba(0, 221, 176, 0.25);
  background: rgba(11, 15, 18, 0.6);
  color: #ffffff;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
  box-shadow: 0 0 10px rgba(0, 221, 176, 0.25);
}
#symptomSearch::placeholder {
  color: rgba(255, 255, 255, 0.55);
}
#symptomSearch:focus {
  border-color: #00ddb0;
  box-shadow: 0 0 12px rgba(0, 221, 176, 0.6);
  background: rgba(11, 15, 18, 0.8);
}

/* Dropdown list */
.suggestions {
  list-style: none;
  margin: 8px auto 0;
  padding: 0;
  background: rgba(11, 15, 18, 0.9);
  border-radius: 10px;
  box-shadow: 0 4px 14px rgba(0, 221, 176, 0.3);
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 420px;
  z-index: 100;
  border: 1px solid rgba(0, 221, 176, 0.25);
}
.suggestions li {
  padding: 10px 16px;
  color: #f5f7fa;
  font-size: 0.95rem;
  cursor: pointer;
  transition: background 0.25s ease, color 0.25s ease;
}
.suggestions li:hover {
  background: rgba(0, 221, 176, 0.25);
  color: #00ddb0;
}

/* Visit-type buttons under field */
#visitButtons {
  margin-top: 16px;
  text-align: center;
}
#visitButtons button {
  margin: 6px 8px 0 8px;
  padding: 10px 18px;
  border: none;
  border-radius: 8px;
  background: #00ddb0;
  color: #0b0f12;
  font-weight: 700;
  font-family: 'Inter', sans-serif;
  box-shadow: 0 0 10px rgba(0, 221, 176, 0.4);
  cursor: pointer;
  transition: background 0.3s ease, transform 0.2s ease;
}
#visitButtons button:hover {
  background: #0ef1c3;
  transform: translateY(-2px);
}
@keyframes shake {
  0%   { transform: translateX(0); }
  25%  { transform: translateX(-6px); }
  50%  { transform: translateX(6px); }
  75%  { transform: translateX(-6px); }
  100% { transform: translateX(0); }
}

.input-error {
  border-color: #ff6b6b !important;
  box-shadow: 0 0 12px rgba(255, 100, 100, 0.55) !important;
  animation: shake 0.35s ease;
}
    </style>

</head>
<body>
    </div>
    <!-- Hero Section -->
   <!-- Hero Section -->
<section class="hero">
  <div class="veil"></div>
  <div class="grad"></div>

  <div class="hero-content">
    <p class="subhead">Online Telehealth Services</p>
    <h1>Instant Private Medical Visits</h1>
    <p class="sub">
      Confidential concierge care within minutes, handled directly a Private Practice Clinicians..
    </p>

    <div class="cta-group">
      <a href="#symptoms-section" class="btn primary"
   onclick="setTimeout(()=>document.getElementById('symptomSearch').focus(),300)">
   Start an Instant Visit →
</a>
      <a href="#symptoms-section" class="btn secondary"
   onclick="setTimeout(()=>document.getElementById('symptomSearch').focus(),300)">
   Book My Appointment →
</a>

    <!-- Pricing Info -->
    <div class="pricing-info">
      <h3>No Waiting. No Sign ups. No Account Needed</h3>
      <p class="pricing-sub">
        $0.00 to Book — $189.00 Flat Only if Provider Accept 
      </p>
    </div>

    <div class="availability">
      <span class="dot"></span>
      <span id="timerText">Lamonia — Next available in 05 m 00 s</span>
    </div>

    <div class="badges">
      <span class="badge">🟢 HIPAA Secure</span>
      <span class="badge">💳 Stripe Encrypted</span>
      <span class="badge" id="locationBadge">🏥 <span id="userState">Florida</span> Licensed</span>

    </div>

    
  </div>
</section>

<!-- Doctor Profile (moved below hero) -->
<section class="doctor-profile">
  <img
    src="F381103B-745E-4447-91B2-F1E32951D47F.jpeg"
    alt="LaMonica Hodges"
  />
  <h2>LaMonica A. Hodges, MSN, APRN, FNP-C</h2>
  <p>
    Board-Certified Family Medicine · 10 + Years Experience .Private 
  </p>
  <p class="states">
 AL · AZ · CO · DE · FL · <strong>GA</strong> · ID · IL · <strong>MI</strong> · 
  <strong>MS</strong> · NV · NM · ND · <strong>OH</strong> · OR · UT · VA · WA · DC
</p>

</section>
<!-- ✅ Medazon Concierge Checkout Section -->



<!-- Fold 2: Services, How It Works, Visit Type -->
<section id="fold2">
        <div class="fold2-wrapper">
            <h2 class="fold2-title">Our Services</h2>
            <p class="fold2-sub">
                No waiting rooms · No insurance · No records shared.
            </p>
            <div class="six-grid">
                <div class="svc-card" style="background-image:url('https://medazonhealth.com/private/visit/uti-virtual-visit/1.jpg')">
                    <div class="svc-overlay"><h3>UTI/STD</h3><span>Start in 5 Minutes</span></div>
                </div>
                <div class="svc-card" style="background-image:url('	https://medazonhealth.com/private/visit/adhd-evaluation-follow-up/1.jpg')">
                    <div class="svc-overlay"><h3>Cold / Flu</h3><span>Fast Relief</span></div>
                </div>
                <div class="svc-card" style="background-image:url('https://medazonhealth.com/private/visit/COVID-19/3.jpg')">
                    <div class="svc-overlay"><h3>Anxiety / Depression</h3><span>Private Care</span></div>
                </div>
                <div class="svc-card" style="background-image:url('https://medazonhealth.com/private/visit/weight-loss-initial-consultation/1.jpg')">
                    <div class="svc-overlay"><h3>Weight Care/Injections</h3><span>Clinician Guided</span></div>
                </div>
                <div class="svc-card" style="background-image:url('https://medazonhealth.com/private/visit/phone-call-visit/4.jpg')">
                    <div class="svc-overlay"><h3>ADHD Initial
/Follow-Up</h3><span>Same Provider</span></div>
                </div>
                <div class="svc-card" style="background-image:url('https://medazonhealth.com/private/visit/urgent-care-general/maw.jpg')">
                    <div class="svc-overlay"><h3>Men / Women's Health</h3><span>Dermatology</span></div>
                </div>
                
            </div>
            </div>
            <!-- 🩺 Patient Symptoms Section -->
<!-- 🩺 Tell Us Your Symptoms -->
<section id="symptoms-section" class="symptoms-section">
  <div class="symptoms-inner">
    <h2 class="symptoms-title">Tell Us Your Symptoms</h2>
    <p class="symptoms-desc">
      A brief description helps the provider review quickly.
    </p>
    <label for="symptoms-input" class="symptoms-label">What brings you in today?</label>
  <div style="position:relative;max-width:420px;margin:auto;">
  <input id="symptomSearch"
         type="text"
         placeholder="Type your symptom or condition..."
         autocomplete="off"
         disabled>
  <ul id="suggestions" class="suggestions"></ul>
</div>
<div id="visitButtons"></div>
  <div class="cta-row mid" id="ctaButtons">
  <a href="#" class="btn primary" id="anonBtn">Start Anonymously →</a>
  <a href="#" class="btn secondary" id="bookBtn">Book An Appointment →</a>
</div>

  </a>
</div>
</section>



            <section id="how-it-works" class="mint-section">
  <h2 class="fold2-title">How It Works</h2>
  <div class="how-steps">
    <div class="step">
      <img src="https://medazonhealth.com/private/visit/video-visit/download (3).svg" alt="Appointment type">
      <h3>Choose Your Appointment Type</h3>
      <p>Talk to a Doctor Now or a Book for Later — both private & secure.</p>
    </div>
    <div class="step">
      <img src="https://medazonhealth.com/private/visit/video-visit/download (2).svg" alt="Intake form">
      <h3>Answer a Few Quick Questions</h3>
      <p>Complete 3–5 short intake questions to help your provider prepare or send Rx to phamacy when appropriate.</p>
    </div>
    <div class="step">
      <img src="https://medazonhealth.com/private/visit/video-visit/download (1).svg" alt="Chat with provider">
      <h3>Consult & Receive Treatment</h3>
      <p>Speak with a U.S.-licensed provider — if appropriate, medication is sent to your local pharmacy.</p>
    </div>
  </div>
</section>

            </div>
            <h2 class="fold2-title">Choose Your Visit Type</h2>
            <div class="visit-type-grid">
                <div class="visit-card">
                    <img src= "https://medazonhealth.com/private/visit/flu-cold/2.jpg" alt="Instant Visit">
                    <div class="visit-overlay"><h3>Instant Visit</h3><p>Get Seen Now</p></div>
                </div>
                <div class="visit-card">
                    <img src= "https://medazonhealth.com/private/visit/flu-cold/3.jpg"alt="Phone Visit">
                    <div class="visit-overlay"><h3>Book an Appointment <span class="optional"></span></h3><p>Select Your Preferred Time</p></div>
                </div>

                </div>
            </div>
            <div class="cta-row">
                <button id="talkDoctor" class="cta-primary">Talk to a Doctor Now →</button>
                <button id="bookLater" class="cta-secondary">Book for Later →</button>
                </div>
    </section>

    <!-- Fold 3: FAQ and SEO -->
    <section id="fold3">
        <div class="fold3-wrapper">
            <h2 class="fold3-title">Why Patients Trust Medazon</h2>
            <p class="fold3-lead">
                Every visit is reviewed by U.S.-licensed clinicians with years of real-world experience.
                Our HIPAA-secure platform ensures expert guidance, transparent pricing, and
                complete privacy from intake to prescription.
            </p>
            <div class="cta-row">
                <button id="talkDoctor" class="cta-primary">Talk to a Doctor Now →</button>
                <button id="bookLater" class="cta-secondary">Book for Later →</button>
            </div>
            <div class="faq-grid">
                <div class="faq-item">
                    <button class="faq-question">What conditions can Medazon treat?</button>
                    <div class="faq-answer">
                        <p>We handle a broad range of primary-care and wellness concerns —
                            including refills, weight management, mental health, and urgent issues.
                            All consultations are reviewed by credentialed providers.</p>
                    </div>
                </div>
                <div class="faq-item">
                    <button class="faq-question">How fast will a doctor review my intake?</button>
                    <div class="faq-answer">
                        <p>Most requests are reviewed within minutes during business hours
                            and always within a few hours after submission.</p>
                    </div>
                </div>
                <div class="faq-item">
                    <button class="faq-question">Is my personal information secure?</button>
                    <div class="faq-answer">
                        <p>Yes — Medazon uses HIPAA-compliant encryption and never shares or
                            sells your data. All records are stored privately and securely.</p>
                    </div>
                </div>
                <div class="faq-item">
                    <button class="faq-question">Do I need insurance?</button>
                    <div class="faq-answer">
                        <p>No insurance required. You pay a flat transparent rate for your visit;
                            prescriptions are sent to your preferred pharmacy.</p>
                    </div>
                </div>
                <div class="faq-item">
                    <button class="faq-question">Can I choose my provider?</button>
                    <div class="faq-answer">
                        <p>You can request to continue with the same provider for follow-ups
                            to maintain continuity of care.</p>
                    </div>
                </div>
                <div class="faq-item">
                    <button class="faq-question">What if my case requires in-person care?</button>
                    <div class="faq-answer">
                        <p>Our clinicians will guide you to an appropriate local facility if
                            an in-person evaluation is needed — no extra charge for the referral.</p>
                    </div>
                </div>
            </div>
            <div class="cta-row mid">
                <button id="talkDoctor" class="cta-primary">Talk to a Doctor Now →</button>
                <button id="bookLater" class="cta-secondary">Book for Later →</button>
                </div>
            </div>
            <div class="seo-footer">
                <p>
                    Medazon Health provides secure, same-day virtual medical consultations for adults nationwide.
                    Our board-certified clinicians offer expert telehealth care for common conditions, renewals,
                    and preventive wellness — establishing trust and accessibility in digital healthcare.
                </p>
            </div>
            
    </section>

    <!-- Footer -->
    <footer id="footer">
        <div class="footer-wrapper">
            
            <div class="footer-brand">
                <h3 class="brand">Medazon Health</h3>
                <p class="tagline">Secure · Licensed · Private Virtual Care</p>
            </div>
            <div class="compliance-links">
                <a href="/terms">Terms of Service</a>
                <a href="/privacy">Privacy Policy</a>
                <a href="/hipaa">HIPAA Notice</a>
                <a href="/licensure">State Licensure</a>
                <a href="/consent">Telehealth Consent</a>
            </div>
            <div class="contact-social">
                <a href="mailto:support@medazonhealth.com">support@medazonhealth.com</a>
                <div class="social">
                    <a href="https://facebook.com" aria-label="Facebook">🌐</a>
                    <a href="https://instagram.com" aria-label="Instagram">📸</a>
                    <a href="https://linkedin.com" aria-label="LinkedIn">💼</a>
                </div>
            </div>
            <p class="legal">
                © <span id="year"></span> Medazon Health — All rights reserved.<br>
                Medazon Health operates under U.S. state telehealth regulations.  
                All visits are reviewed by licensed providers within the United States.
            </p>
        </div>
        <script type="application/ld+json">
        {
            "@context": "https://schema.org",
            "@type": "MedicalOrganization",
            "name": "Medazon Health",
            "url": "https://medazonhealth.com",
            "logo": "https://medazonhealth.com/assets/logo.png",
            "sameAs": [
                "https://facebook.com/medazonhealth",
                "https://instagram.com/medazonhealth",
                "https://linkedin.com/company/medazonhealth"
            ],
            "contactPoint": {
                "@type": "ContactPoint",
                "contactType": "customer support",
                "email": "support@medazonhealth.com"
            },
            "founder": "U.S. Licensed Clinicians",
            "description": "Medazon Health provides secure, HIPAA-compliant virtual care, prescriptions, and wellness follow-ups across the United States."
        }
        </script>
        <script type="application/ld+json">
        {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
                {
                    "@type": "Question",
                    "name": "What conditions can Medazon treat?",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Medazon Health handles primary-care and wellness visits, including refills, weight management, mental health, and urgent care — all by licensed clinicians."
                    }
                },
                {
                    "@type": "Question",
                    "name": "Is my personal information secure?",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Yes. Medazon Health follows HIPAA standards and uses full encryption for every interaction."
                    }
                }
            ]
        }
        </script>
    </footer>

    <script>
        // Reset & Step Control Logic
            document.querySelectorAll('.reason-pill').forEach(pill => pill.classList.remove('active'));
            document.querySelectorAll('.modal-main input').forEach(input => input.value = '');
            document.getElementById('step1Error').textContent = '';
            document.getElementById('step2Error').textContent = '';
            document.getElementById('payment-message').textContent = '';
            document.getElementById('reassure').textContent = '';
        });

        // Step control
        const step1 = document.getElementById('step1');
        const step2 = document.getElementById('step2');
        const step3 = document.getElementById('step3');

        document.querySelectorAll('.reason-pill').forEach(b => b.addEventListener('click', () => {
            document.querySelectorAll('.reason-pill').forEach(x => x.classList.remove('active'));
            b.classList.add('active');
        }));

        document.getElementById('toStep2').onclick = () => {
            if ([...step1.querySelectorAll('input')].every(i => i.value.trim()) && document.querySelector('.reason-pill.active')) {
                step1.style.display = 'none';
                step2.style.display = 'block';
                document.getElementById('step1Error').textContent = '';
            } else {
                document.getElementById('step1Error').textContent = 'Please complete all fields and select a reason for your visit.';
            }
        };

        document.getElementById('toStep3').onclick = () => {
            if ([...step2.querySelectorAll('input')].every(i => i.value.trim())) {
                step2.style.display = 'none';
                document.getElementById('step2Error').textContent = '';
                // Simulate review animation
                setTimeout(() => { step3.style.display = 'block'; }, 2000);
            } else {
                document.getElementById('step2Error').textContent = 'Please complete all information.';
            }
        };

        // Stripe initialization
        const stripe = Stripe('pk_test_12345');
        const elements = stripe.elements({ appearance: { theme: 'night' } });
        const cardElement = elements.create('card', {
            style: {
                base: {
                    color: '#fff',
                    iconColor: '#00e5be',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    '::placeholder': { color: '#999' }
                },
                invalid: { color: '#ff6b6b', iconColor: '#ff6b6b' }
            }
        });
        cardElement.mount('#card-element');

        document.getElementById('confirm').addEventListener('click', async () => {
            document.getElementById('payment-message').textContent = '';
            document.getElementById('reassure').textContent = '';
            try {
                const res = await fetch('/api/create-payment-intent', { method: 'POST' });
                if (!res.ok) throw new Error('No server');
                const { clientSecret } = await res.json();
                const result = await stripe.confirmCardPayment(clientSecret, { payment_method: { card: cardElement } });
                if (result.error) {
                    document.getElementById('payment-message').textContent = result.error.message;
                    document.getElementById('reassure').textContent = "We’re here for you — please double-check your card details or contact support if you need help.";
                    fetch('/api/send-support-sms', { method: 'POST' });
                } else if (result.paymentIntent.status === 'succeeded') {
                    document.getElementById('payment-message').style.color = '#00e5be';
                    document.getElementById('payment-message').textContent = '✅ Approved — your provider will review shortly.';
                }
            } catch (e) {
                document.getElementById('payment-message').textContent = 'Unable to reach server — please retry.';
            }
        });

        // Timer for availability
        let totalSeconds = 5 * 60;
        const timer = document.getElementById('timerText');
        const dot = document.querySelector('.dot');
        function updateTimer() {
            const m = Math.floor(totalSeconds / 60);
            const s = totalSeconds % 60;
            timer.textContent = \` LaMonica's — Next available in ${m.toString().padStart(2, '0')} m ${s.toString().padStart(2, '0')} s\`;
            if (totalSeconds <= 0) {
                dot.style.background = '#00DDB0';
                timer.textContent = "🟢LaMonica is available now";
                clearInterval(interval);
            }
            totalSeconds--;
        }
        const interval = setInterval(updateTimer, 1000);

        // Fold 2 scroll animation
        // Fold 2 scroll animation (desktop only)
// ---- Fold 2 slide-in animation (mobile-safe) ----
document.addEventListener("DOMContentLoaded", () => {
  const fold2 = document.getElementById("fold2");
  if (!fold2) return;

  const targets = fold2.querySelectorAll(".svc-card, .how-step, .visit-card");

  // Start hidden
  targets.forEach(el => {
    el.style.opacity = "0";
    el.style.transform = "translateY(40px)";
    el.style.transition = "opacity 0.6s ease, transform 0.6s ease";
  });

  const reveal = (entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = "1";
        entry.target.style.transform = "translateY(0)";
        observer.unobserve(entry.target);   // reveal only once
      }
    });
  };

  // IntersectionObserver = efficient slide-in
  const observer = new IntersectionObserver(reveal, {
    threshold: 0.1,
    rootMargin: "0px 0px -10% 0px"
  });

  targets.forEach(el => observer.observe(el));
});


        // Fold 3 FAQ collapse and scroll animation
        document.querySelectorAll('.faq-question').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = btn.parentElement;
                item.classList.toggle('active');
            });
        });

// ---- Fold 2 slide-in animation (mobile-safe) ----
document.addEventListener("DOMContentLoaded", () => {
  const fold2 = document.getElementById("fold2");
  if (!fold2) return;

  const targets = fold2.querySelectorAll(".svc-card, .how-step, .visit-card");

  // Start hidden
  targets.forEach(el => {
    el.style.opacity = "0";
    el.style.transform = "translateY(40px)";
    el.style.transition = "opacity 0.6s ease, transform 0.6s ease";
  });

  const reveal = (entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = "1";
        entry.target.style.transform = "translateY(0)";
        observer.unobserve(entry.target);   // reveal only once
      }
    });
  };

  // IntersectionObserver = efficient slide-in
  const observer = new IntersectionObserver(reveal, {
    threshold: 0.1,
    rootMargin: "0px 0px -10% 0px"
  });

  targets.forEach(el => observer.observe(el));
});


        // Dynamic year in footer
        document.getElementById('year').textContent = new Date().getFullYear();
    </script>
      <!-- Smart Search -->
<script src="https://cdn.jsdelivr.net/npm/fuse.js@6.6.2"></script>
<script>
/* -------------------------
   CONDITION LIST
-------------------------- */
const list = [
  { symptom:"burning urination", name:"Urinary Tract Infection (UTI)" },
  { symptom:"headache", name:"Migraine / Headache" },
  { symptom:"stomach pain", name:"Abdominal Pain / Indigestion" },
  { symptom:"nausea", name:"Gastroenteritis / Food Poisoning" },
  { symptom:"weight loss", name:"Weight Management / GLP-1 Consultation" },
  { symptom:"adhd", name:"ADHD Evaluation / Focus Issues" },
  { symptom:"anxiety", name:"Anxiety / Depression" },
  { symptom:"birth control", name:"Birth Control / Contraception" },
  { symptom:"rash", name:"Rash / Allergic Reaction" },
  { symptom:"cold", name:"Cold / Flu / Sinus Infection" },
  { symptom:"back pain", name:"Back Pain / Muscle Strain" },
  { symptom:"private reason", name:"Private / Sensitive Concern" },
  { name:"Something Else" }
];

let fuse = new Fuse(list, { keys:["symptom","name"], threshold:0.35 });

/* -------------------------
   DOM ELEMENTS
-------------------------- */
const input        = document.getElementById("symptomSearch");
const listEl       = document.getElementById("suggestions");
const btnBox       = document.getElementById("visitButtons");
const ctaButtons   = document.getElementById("ctaButtons");

input.disabled = false;

/* -------------------------
   CTA HIDE / SHOW
-------------------------- */
function hideCTAButtons() {
  if (ctaButtons) ctaButtons.style.display = "none";
}
function showCTAButtons() {
  if (ctaButtons) ctaButtons.style.display = "flex";
}

/* -------------------------
   AUTOCOMPLETE
-------------------------- */
input.addEventListener("input", e => {
  const val = e.target.value.trim().toLowerCase();

  listEl.innerHTML = "";
  btnBox.innerHTML = "";

  // hide CTA buttons while typing
  hideCTAButtons();

  if (!val) return;

  const results = fuse.search(val).map(r => r.item);

  if (!results.find(r => r.name === "Something Else")) {
    results.push({ name: "Something Else" });
  }

  results.slice(0, 8).forEach(item => {
    const li = document.createElement("li");
    li.textContent = item.name;
    li.onclick = () => handleSelection(item);
    listEl.appendChild(li);
  });
});

/* -------------------------
   HANDLE CONDITION SELECTION
-------------------------- */
function handleSelection(item){
  listEl.innerHTML = "";

  if (item.name === "Something Else") {
    input.value = "";
    input.placeholder = "Describe your condition...";
    input.disabled = false;
    input.focus();
  } else {
    input.value = item.name;
    input.disabled = false;

    setTimeout(() => {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }, 10);
  }

  // Hide CTA buttons once condition selected
  hideCTAButtons();

  // Show NEXT button
  btnBox.innerHTML = `
    <button id="nextButton" class="btn primary">NEXT →</button>
  `;

  document.getElementById("nextButton").onclick = () => {
    const selected = input.value.trim();
    if (!selected) {
      alert("Please select a condition before continuing.");
      input.focus();
      return;
    }
    // NEXT routing:
    window.location.href =
      "https://medazonhealth.com/private/uti-std/florida/intake-flow.html?type=async&condition=" +
      encodeURIComponent(selected);
  };
}

/* -------------------------
   BLOCK CTA BUTTONS UNTIL CONDITION SELECTED
-------------------------- */
function enforceConditionBeforeCTA(evt) {
    const val = input.value.trim();

    if (!val) {
        evt.preventDefault();

        // shake animation on the input
        input.classList.add("input-error");

        // auto-remove shake class after animation
        setTimeout(() => {
            input.classList.remove("input-error");
        }, 400);

        // focus + scroll to field
        input.focus();
        document
            .getElementById("symptoms-section")
            .scrollIntoView({ behavior: "smooth" });

        return false;
    }

    return true;
}

document.getElementById("anonBtn")?.addEventListener("click", enforceConditionBeforeCTA);
document.getElementById("bookBtn")?.addEventListener("click", enforceConditionBeforeCTA);
</script>
</body>
</html>
