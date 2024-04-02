const puppeteer = require("puppeteer");
const fs = require("fs");
require("dotenv").config();

async function extractKeyValuePair(page, xpath) {
  try {
    const element = await page.$(xpath);
    const category = await element.$eval("dt", (node) =>
      node.textContent.trim()
    );
    const value = await element.$eval("dd", (node) => node.textContent.trim());
    return { category, value };
  } catch (error) {
    console.error("Error extracting key-value pair:", error);
    return { category: null, value: null };
  }
}

async function scrapeCompanyData(url) {
  let browser;
  try {
    browser = await puppeteer.launch({
      args: [
        "--disable-setuid-sandbox",
        "--no-sandbox",
        "--single-process",
        "--no-zygote",
      ],
      executablePath:
        process.env.NODE_ENV === "production"
          ? process.env.PUPPETEER_EXECUTABLE_PATH
          : puppeteer.executablePath(),
    });

    const page = await browser.newPage();
    await page.goto(url);
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for the page to load

    try {
      // Close the pop-up window if present
      await page.click("#organization_guest_contextual-sign-in button");
      console.log("Pop-up window closed successfully.");
    } catch (error) {
      console.log("No pop-up window found or an error occurred:", error);
    }

    const companyData = {
      url: url,
    };

    companyData.companyName = await page.$eval(
      "#main-content section:nth-child(1) h1",
      (el) => el.textContent.trim()
    );
    companyData.about = await page.$eval(
      "#main-content section:nth-child(1) div:nth-child(2) p",
      (el) => el.textContent.trim()
    );

    const xpaths = [
      "#main-content section:nth-child(1) div:nth-child(2) dl div:nth-child(1)", // Website
      "#main-content section:nth-child(1) div:nth-child(2) dl div:nth-child(2)", // Industry
      "#main-content section:nth-child(1) div:nth-child(2) dl div:nth-child(3)", // Company Size
      "#main-content section:nth-child(1) div:nth-child(2) dl div:nth-child(4)", // Headquarters
      "#main-content section:nth-child(1) div:nth-child(2) dl div:nth-child(5)", // Founded
      "#main-content section:nth-child(1) div:nth-child(2) dl div:nth-child(6)", // Type
      "#main-content section:nth-child(1) div:nth-child(2) dl div:nth-child(7)", // Specialties
    ];

    for (const xpath of xpaths) {
      const { category, value } = await extractKeyValuePair(page, xpath);
      if (category) {
        const camelCaseKey = category.replace(" ", "").toLowerCase();
        companyData[camelCaseKey] = value;
      }
    }

    try {
      const profileImageElement = await page.$(
        "html > body > main > section:nth-child(1) > section > div > div:nth-child(1) > img"
      );
      const imageUri = await profileImageElement.evaluate((node) =>
        node.getAttribute("src")
      );

      companyData.avatarUrl = imageUri;
    } catch (error) {
      console.error("Error scraping profile image URI:", error);
    }

    return companyData;
  } catch (error) {
    console.error("An error occurred:", error);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

const scrapeLogic = async (res, company) => {
  try {
    const url = `https://www.linkedin.com/company/${company}`;
    const companyData = await scrapeCompanyData(url);
    if (companyData) {
      res.send(companyData);
    } else {
      res.send(`No data found for company: ${company}`);
    }
  } catch (e) {
    console.error("An error occurred while running Puppeteer:", e);
    res.send(`Something went wrong while running Puppeteer: ${e}`);
  }
};

module.exports = { scrapeLogic };
