# PennyWay — Budget Tracker

PennyWay is a personal finance tracker I built to practice frontend development and work with real data logic. The idea came from wanting a simple tool to track monthly spending without relying on apps that require accounts or subscriptions.

## What it does

The app has three main sections.

**Home** is where you log expenses and income for any month. You can set spending limits per category and see a live donut chart that breaks down where your money goes. There's also a quick summary at the top of the form showing how much you've spent and how much is left for the current month.

**Savings** lets you track money you're putting aside. There's a visual jar that fills up as you add savings, a progress bar, and a wishlist where you can set savings goals. The jar is connected to the main expense tracker, so savings show up in your monthly overview automatically.

**Reports** gives a broader view across months — income vs expenses, savings over time, investing totals, and a chart comparing actual spending against the limits you've set.

All data is stored locally in the browser, no backend needed.

## Built with

- HTML, CSS, JavaScript — no frameworks
- Chart.js for data visualisation
- localStorage for data persistence

## Why I built it

This was partly a portfolio project and partly something I actually use. I wanted to get better at working with dynamic data in vanilla JS — things like managing state across components, rendering charts that update in real time, and keeping the UI consistent as data changes.

It's also been a good exercise in thinking about UX: how to make a form feel fast to use, how to show financial data in a way that's readable at a glance, and how small design decisions affect how much you actually enjoy using something.
