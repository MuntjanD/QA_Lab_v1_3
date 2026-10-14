# BuggyThreads Co. - QA Trainee Sandbox & Report Evaluator

A deliberately buggy e-commerce storefront used as a QA practice sandbox. The app is designed to help trainees explore UI bugs, validate forms, analyze security issues, and practice writing high-quality bug reports.

This project contains a mock shopping experience with:
- product browsing and filtering
- cart and checkout flows
- login / registration / profile settings
- bug checklist tracking
- warehouse SQL exercise
- bug report evaluator

No framework or build step is required — the app is a static HTML page with inline JavaScript and Tailwind CSS loaded via CDN.

## Overview

BuggyThreads is a mock storefront for testing and learning:
- visual defects
- functional defects
- validation flaws
- auth and security weaknesses
- localization issues
- report quality evaluation

The app intentionally contains many issues that trainees can find and document as bug reports.

## Features

- Product catalog with category filtering
- Search box with mock product lookup
- Max price filter and sorting controls
- Product quick view modal
- Quantity and size selection
- Shopping cart with subtotal, tax, discount logic
- Coupon handling
- Checkout form and order submission flow
- Login and registration forms
- User profile editing
- Local storage persistence
- Warehouse SQL Lab with basic product queries
- QA Control Center with bug checklist and evaluator
- Saved bug report log

## Project Structure

```text
QA_Lab_v1_3/
├── public/
│   └── index.html
├── README.md
└── .gitignore (if present)
