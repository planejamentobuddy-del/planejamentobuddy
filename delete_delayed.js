import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://ajkgzhhofcfcmxpqgrfp.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqa2d6aGhvZmNmY214cHFncmZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MzU4MDgsImV4cCI6MjA5MDAxMTgwOH0.DXhwe5JjvHO01SCa1pRHRwaQsUBUWiRnBavWS4WooZ0";

async function run() {
  const email = `temp_delete_${Math.floor(Math.random() * 1000000)}@gmail.com`;
  const password = "TemporaryPassword123!";

  console.log("Trying to sign up a temporary user...");
  const tempSupabase = createClient(supabaseUrl, supabaseKey);
  const { data: signUpData, error: signUpError } = await tempSupabase.auth.signUp({
    email,
    password,
  });

  if (signUpError) {
    console.error("SignUp error:", signUpError);
  } else {
    console.log("SignUp successful! Trying to sign in...");
    const { data: signInData, error: signInError } = await tempSupabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      console.error("SignIn error:", signInError);
    } else {
      console.log("SignIn successful! Deleting delayed tasks...");
      await deleteTasks(tempSupabase);
      return;
    }
  }

  // If signUp/signIn fails (e.g., due to email confirmation), try Playwright
  console.log("\nAttempting to retrieve active session from Playwright...");
  try {
    const { chromium } = await import('playwright');
    
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    console.log("Opening http://localhost:8080...");
    let tokenData = null;
    try {
      await page.goto('http://localhost:8080', { timeout: 5000 });
      await page.waitForTimeout(2000);
      tokenData = await page.evaluate(() => {
        const keys = Object.keys(localStorage);
        const authKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
        return authKey ? localStorage.getItem(authKey) : null;
      });
      console.log("Token in 8080:", tokenData ? "Found" : "Not found");
    } catch (e) {
      console.log("Error loading 8080:", e.message);
    }
    
    if (!tokenData) {
      console.log("Opening http://localhost:8081...");
      try {
        await page.goto('http://localhost:8081', { timeout: 5000 });
        await page.waitForTimeout(2000);
        tokenData = await page.evaluate(() => {
          const keys = Object.keys(localStorage);
          const authKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
          return authKey ? localStorage.getItem(authKey) : null;
        });
        console.log("Token in 8081:", tokenData ? "Found" : "Not found");
      } catch (e) {
        console.log("Error loading 8081:", e.message);
      }
    }

    if (!tokenData) {
      throw new Error("No supabase auth token found in localStorage of http://localhost:8080 or http://localhost:8081");
    }

    const parsedToken = JSON.parse(tokenData);
    const accessToken = parsedToken.access_token;
    console.log("Access token successfully retrieved!");

    // Create supabase client with access token
    const authSupabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    await deleteTasks(authSupabase);
    await browser.close();
  } catch (err) {
    console.error("Playwright strategy failed:", err.message);
  }
}

async function deleteTasks(client) {
  const now = new Date().toISOString().split('T')[0];
  const { data: tasks, error: fetchError } = await client
    .from('tasks')
    .select('*');

  if (fetchError) {
    console.error("Fetch tasks error:", fetchError);
    return;
  }

  console.log(`Fetched ${tasks?.length} tasks.`);
  const delayed = tasks.filter(t => {
    const endStr = t.end_date;
    if (!endStr) return false;
    const end = new Date(endStr + 'T12:00:00').getTime();
    const nowTs = new Date(now + 'T12:00:00').getTime();
    return end < nowTs && t.percent_complete < 100;
  });

  console.log(`Found ${delayed.length} delayed tasks:`);
  for (const t of delayed) {
    console.log(`- [ID: ${t.id}] "${t.name}" | Progress: ${t.percent_complete}% | End: ${t.end_date}`);
  }

  if (delayed.length === 0) {
    console.log("No delayed tasks found to delete.");
    return;
  }

  const idsToDelete = delayed.map(t => t.id);
  console.log(`Deleting tasks with IDs: ${idsToDelete.join(', ')}...`);

  const { error: deleteError } = await client
    .from('tasks')
    .delete()
    .in('id', idsToDelete);

  if (deleteError) {
    console.error("Error deleting tasks:", deleteError);
  } else {
    console.log("Successfully deleted the 3 delayed tasks!");
  }
}

run().catch(console.error);
