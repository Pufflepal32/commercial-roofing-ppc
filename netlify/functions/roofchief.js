// Roof Chief CRM Integration
// Netlify Function to proxy form submissions

const ROOFCHIEF_KEY = "db37af757ce98c37893f";
const ROOFCHIEF_ENDPOINT = "https://my.roofchief.com/inc/ajax.contactintake.php";

// CORS headers
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

exports.handler = async (event) => {
  // Handle preflight OPTIONS request
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  // Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ ok: false, error: "Method not allowed" }),
    };
  }

  try {
    const data = JSON.parse(event.body);

    console.log("Received form submission:", data);

    // HONEYPOT CHECK - if the hidden "website" field has any value, it's a bot
    if (data.website && data.website.trim() !== "") {
      console.log("Honeypot triggered! Bot submission blocked:", {
        website: data.website,
        email: data.email,
        timestamp: new Date().toISOString(),
      });
      // Return fake success to fool the bot
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ok: true,
          message: "Lead successfully submitted",
        }),
      };
    }

    // Parse name into first/last (split on first space)
    const nameParts = (data.name || "").trim().split(" ");
    const firstName = nameParts[0] || "Lead";
    const lastName = nameParts.slice(1).join(" ") || "Unknown";

    // Strip phone number formatting (keep only digits)
    const cleanPhone = (data.phone || "").replace(/\D/g, "");

    // Build form data for RoofChief API
    const params = new URLSearchParams();

    // REQUIRED FIELDS
    params.append("RC_intake[key]", ROOFCHIEF_KEY);
    params.append("RC_intake[extra]", ""); // Required honeypot field (must be empty)
    params.append("RC_intake[fname]", firstName);
    params.append("RC_intake[lname]", lastName);
    params.append("RC_intake[email]", data.email || "");
    params.append("RC_intake[phone1]", cleanPhone);
    params.append("RC_intake[address][street]", data.address || "");
    params.append("RC_intake[address][city]", "See Notes");
    params.append("RC_intake[address][state]", "NC");
    params.append("RC_intake[address][postal]", data.zip || "00000");

    // CAPTCHA BYPASS (required for custom forms)
    params.append("g-recaptcha-response", "rchief");

    // ADDITIONAL DATA (as notes)
    params.append("RC_intake[note][full_address]", data.address || "");
    params.append("RC_intake[note][full_name]", data.name || "");
    params.append("RC_intake[note][sms_consent]", data.smsConsent ? "Yes" : "No");
    params.append("RC_intake[note][source]", data.source || "Commercial Roofing PPC Landing Page");

    console.log("Submitting to RoofChief...");

    // Submit to RoofChief
    const response = await fetch(ROOFCHIEF_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const responseText = await response.text();

    console.log("RoofChief response:", responseText);
    console.log("Is success:", responseText.trim() === "1");

    // RoofChief returns "1" on success
    if (responseText.trim() === "1") {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ok: true,
          message: "Lead successfully submitted",
        }),
      };
    } else {
      console.error("RoofChief error:", responseText);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          ok: false,
          error: "Submission failed",
          details: responseText.substring(0, 200),
        }),
      };
    }
  } catch (error) {
    console.error("API error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        ok: false,
        error: "Server error",
        message: error.message || "Unknown error",
      }),
    };
  }
};
