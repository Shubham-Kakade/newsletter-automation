// generate-newsletter.js
// This script runs headlessly in a GitHub Action.

const { GoogleGenerativeAI } = require('@google/generative-ai');
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');

// --- Main Function ---
async function main() {
    console.log("Starting newsletter generation process...");

    // 1. Read Secrets and Prompt from GitHub Actions Environment
    const apiKey = process.env.GEMINI_API_KEY;
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const recipientEmails = process.env.RECIPIENT_EMAILS;
    const prompt = process.env.NEWSLETTER_PROMPT; // Read the prompt from the environment

    // Validation to ensure secrets and prompt are loaded
    if (!prompt || !apiKey || !smtpHost || !smtpUser || !smtpPass || !recipientEmails) {
        console.error("Error: Missing prompt or one or more required environment variables (secrets).");
        process.exit(1);
    }
    console.log(`Received prompt: "${prompt}"`);

    // --- Gemini API Call ---
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    let newsItems;
    try {
        console.log("Generating content from Gemini...");
        const generationPrompt = `
            Based on the topic "${prompt}", generate a list of 5 to 7 important and current trends.
            For each trend, provide a concise, engaging headline and a short summary (1-2 sentences).
            Return the result as a valid JSON array of objects, where each object has a "headline" and a "summary" key.
        `;
        const result = await model.generateContent(generationPrompt);
        const response = await result.response;
        const text = response.text();
        const jsonString = text.replace(/```json|```/g, '').trim();
        newsItems = JSON.parse(jsonString);
        console.log(`Successfully generated ${newsItems.length} news items.`);
    } catch (error) {
        console.error("Error generating news from Gemini:", error);
        process.exit(1);
    }

    // --- HTML Generation ---
    try {
        console.log("Reading email template...");
        const template = await fs.readFile('./newsletter-template.html', 'utf-8');

        const newsHtml = newsItems.map((item, index) => {
            if (index === 0) { // Main story style
                return `<tr><td><img src="https://images.unsplash.com/photo-1677756119517-756a188d2d94?q=80&w=1470&auto=format&fit=crop" width="100%" style="max-width: 100%; height: auto; display: block;" alt="Main Story"><table border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td bgcolor="#0d3d8a" style="padding: 20px; color: #ffffff; font-family: Arial, sans-serif;"><h2 style="margin: 0; font-size: 22px;">${item.headline}</h2></td></tr><tr><td style="padding: 20px; border: 1px solid #dddddd; border-top: 0; font-family: Arial, sans-serif; font-size: 15px; color: #555; line-height: 1.6;">${item.summary}</td></tr></table></td></tr><tr><td style="font-size: 0; line-height: 0;" height="25">&nbsp;</td></tr>`;
            }
            // Secondary story style
            return `<tr><td><table border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td width="60" valign="top"><img src="https://placehold.co/50x50/2563EB/FFFFFF?text=i&font=arial" width="50" height="50" style="border-radius: 50%;"></td><td valign="top" style="padding-left: 15px; font-family: Arial, sans-serif;"><h3 style="margin: 0 0 5px 0; font-size: 18px; color: #333;">${item.headline}</h3><p style="margin: 0; font-size: 14px; color: #666; line-height: 1.5;">${item.summary}</p></td></tr></table></td></tr><tr><td style="font-size: 0; line-height: 0;" height="20">&nbsp;</td></tr>`;
        }).join('');
        
        const finalHtml = template.replace('{{NEWS_ITEMS_PLACEHOLDER}}', newsHtml);

        const outputDir = './frontend';
        await fs.mkdir(outputDir, { recursive: true });
        await fs.writeFile(path.join(outputDir, 'index.html'), finalHtml);
        console.log("Newsletter HTML file saved to /frontend/index.html.");

        // --- Email Sending ---
        console.log("Sending email to recipients...");
        const transporter = nodemailer.createTransport({
            host: smtpHost, port: smtpPort, secure: smtpPort == 465, auth: { user: smtpUser, pass: smtpPass },
        });

        await transporter.sendMail({
            from: `"AI Weekly Roundup" <${smtpUser}>`,
            to: recipientEmails,
            subject: 'Your AI Weekly Roundup!',
            html: finalHtml,
        });

        console.log("Newsletter sent successfully!");

    } catch (error) {
        console.error("Error during HTML generation or email sending:", error);
        process.exit(1);
    }
}

main();
