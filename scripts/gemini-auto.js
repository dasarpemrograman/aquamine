const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function generateImage(prompt, imageName) {
  console.log(`\n[${imageName}] Starting generation...`);
  
  const browser = await puppeteer.connect({
    browserURL: 'http://localhost:9222'
  });
  
  const pages = await browser.pages();
  const page = pages.find(p => p.url().includes('gemini')) || pages[0];
  
  // Always start fresh chat
  await page.goto('https://gemini.google.com/app', { waitUntil: 'networkidle2' });
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Find and fill the prompt textbox
  const textbox = await page.waitForSelector('div[role="textbox"].ql-editor', { timeout: 10000 });
  await textbox.click();
  await new Promise(resolve => setTimeout(resolve, 500));
  await textbox.type(prompt);
  
  console.log(`[${imageName}] Prompt entered, submitting...`);
  
  // Submit (Enter key)
  await page.keyboard.press('Enter');
  
  // Wait for image generation (15-20 seconds)
  console.log(`[${imageName}] Waiting for generation...`);
  await new Promise(resolve => setTimeout(resolve, 18000));
  
  // Look for download button
  try {
    const downloadBtn = await page.waitForSelector('button[aria-label*="Download"]', { timeout: 5000 });
    await downloadBtn.click();
    console.log(`[${imageName}] Download initiated!`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (e) {
    console.log(`[${imageName}] Could not find download button, image may not be ready`);
  }
  
  await browser.disconnect();
}

const prompts = [
  {
    name: "03-early-rocks",
    prompt: "Realistic photograph of thin yellow-orange iron hydroxide deposits forming on submerged rocks in clear mountain stream, early stage yellow boy contamination, rocks partially covered with faint orange staining, water mostly transparent, AMD pollution beginning stage, natural outdoor lighting, documentary photography style"
  },
  {
    name: "04-forming-patch",
    prompt: "Realistic photograph of small concentrated patch of yellow-orange iron precipitate in stream water, forming stage yellow boy, visible orange sediment cluster, water clarity decreasing around contaminated area, AMD contamination developing, natural daylight, environmental documentation style"
  },
  {
    name: "05-forming-spread",
    prompt: "Realistic photograph of yellow boy contamination spreading along stream edges, forming stage with multiple small orange patches, iron hydroxide deposits becoming more visible, water showing signs of discoloration, AMD impact increasing, outdoor natural light, scientific photography"
  },
  {
    name: "06-moderate-coverage",
    prompt: "Realistic photograph of moderate yellow boy coverage in stream, orange-yellow patches spreading across water surface, iron precipitate visible on rocks and water, AMD contamination at moderate stage, water clarity significantly reduced, natural lighting, environmental monitoring style"
  },
  {
    name: "07-moderate-dense",
    prompt: "Realistic photograph of dense yellow boy deposits in stream section, moderate to heavy orange discoloration, iron hydroxide covering rocks and floating on water surface, AMD pollution clearly visible, water turning murky orange, outdoor setting, documentary photography"
  },
  {
    name: "08-concentrated-thick",
    prompt: "Realistic photograph of thick concentrated yellow boy deposits, heavy orange-yellow iron precipitate layer, AMD contamination severe in localized area, water heavily discolored with dense sediment, pekat orange coverage, natural outdoor light, environmental crisis documentation"
  },
  {
    name: "09-concentrated-pekat",
    prompt: "Realistic photograph of very concentrated yellow boy contamination, extremely thick orange deposits, iron hydroxide forming dense layer on stream surface, AMD pollution at critical level, water almost completely obscured by pekat orange sediment, heavy environmental damage visible, natural lighting"
  },
  {
    name: "10-spreading-merge",
    prompt: "Realistic photograph of yellow boy patches merging and spreading downstream, extensive orange discoloration covering large stream area, iron precipitate spreading rapidly, AMD contamination expanding, water severely affected with widespread orange coverage, outdoor environmental photography"
  },
  {
    name: "11-spreading-flow",
    prompt: "Realistic photograph of yellow boy flowing downstream and spreading, orange contamination following water current, iron deposits spreading along stream channel, AMD pollution affecting wide area, visible orange flow pattern in water, natural setting, documentation style"
  },
  {
    name: "12-severe-heavy",
    prompt: "Realistic photograph of severe yellow boy contamination, very heavy orange coverage across entire stream section, thick iron hydroxide deposits everywhere, AMD pollution at extreme level, water completely discolored orange-brown, severe environmental degradation, outdoor documentation photography"
  },
  {
    name: "13-severe-thick-layer",
    prompt: "Realistic photograph of severe yellow boy with thick sediment layer, extremely heavy iron precipitate coverage, AMD contamination critical stage, orange-brown deposits forming thick crust on water and rocks, water quality severely degraded, environmental disaster level, natural lighting"
  },
  {
    name: "14-very-severe-dense",
    prompt: "Realistic photograph of very severe yellow boy contamination, dense layer of orange-brown iron hydroxide completely covering stream, AMD pollution at maximum severity, thick sediment obscuring all water, extreme environmental damage, heavy toxic appearance, documentary photography style"
  },
  {
    name: "15-very-severe-extreme",
    prompt: "Realistic photograph of extreme yellow boy contamination, complete stream coverage with very thick orange-brown sediment layer, AMD pollution catastrophic level, iron deposits forming solid-looking surface, water ecosystem completely destroyed, worst case environmental disaster, outdoor photography"
  }
];

(async () => {
  console.log('=== Gemini Image Generation Automation ===\n');
  console.log(`Total images to generate: ${prompts.length}\n`);
  
  for (let i = 0; i < prompts.length; i++) {
    const { name, prompt } = prompts[i];
    console.log(`\n[${i + 1}/${prompts.length}] Generating: ${name}`);
    
    try {
      await generateImage(prompt, name);
      console.log(`✓ [${name}] Completed`);
    } catch (error) {
      console.error(`✗ [${name}] Error: ${error.message}`);
    }
    
    // Wait between generations to avoid rate limiting
    if (i < prompts.length - 1) {
      console.log(`\nWaiting 5 seconds before next generation...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  console.log('\n=== All generations completed! ===');
})();
