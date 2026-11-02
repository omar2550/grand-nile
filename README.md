# Hotel Suite – one system for all your hotels

React + Node.js + MongoDB. Opens in any normal browser, on as many devices at the same time as you like. Many hotels live in one system; each user sees only the hotels you give them.

## What it covers
| Area | What you get |
|---|---|
| **General accounts** | Daily entries (journal) made automatically from every sale, payment, purchase and expense; list of accounts; trial balance; profit & loss; balance sheet; manual entries. **Every report downloads as an Excel file.** |
| **Cash, purchases & expenses** | Daily cashbox (cash at start, money in, money out, cash at end) for Reception, Restaurant and Rooftop drawers; purchases and supplier payments; expenses. **One Excel file with all three.** |
| **Rooms (27 per hotel)** | Room calendar, bookings, check-in / check-out, arrivals & departures lists, room cleaning status, nights sold and income per room. |
| **Guests** | Number of people, total bill, **paid and still owed** per guest, with totals. Reception cash is in the daily cashbox. |
| **Rooftop & restaurant** | Separate floor plans, orders, pay by cash / card or **charge to the guest's room**, own income and cash drawer for the rooftop. |
| **QR menus** | Print QR codes for every room (room-service menu) and every rooftop table. Guests scan, see the menu and can send an order; staff confirm it before it goes on the room bill. |
| **Sales & stock** | Items sold (how many, how much money) and **what is left in stock**, portions left per dish, low-stock warnings, deliveries and stock taken out. |
| **Trips & airport rides** | Tours inside Egypt and rides from the hotel to the airport: price charged to the guest, tour-company cost, car & driver cost, profit, and what you still owe each company. |
| **Security** | Job roles (reception, cashier, accountant, storekeeper, manager, administrator, owner), unlimited users, activity log of important actions, nightly automatic backup, manual backup & restore. |

Egypt taxes are built in: **12% service charge + 14% VAT** (on price + service), kept in separate accounts.

## Start it (Windows or any computer)
Needs Node 18+ and a MongoDB database (local, or MongoDB Atlas).
1. Put your database address in `server/.env` → `MONGO_URI=...` (database name at the end, e.g. `/hotel_suite`).
2. In the project folder:
```
npm run install:all
npm run seed      # ERASES that database and fills 2 demo hotels (waits 5 seconds, Ctrl+C to stop)
npm run dev       # open http://localhost:5173
```
The seed takes about a minute on a local database and a few minutes on Atlas.

## Demo logins
| Job | Email | Password | Sees |
|---|---|---|---|
| Owner | admin@grandnile.com | Admin@123 | everything, both hotels |
| General manager | manager@grandnile.com | Manager@123 | both hotels, no settings |
| Reception (Nile) | frontdesk@grandnile.com | Front@123 | rooms, guests, trips, QR |
| Reception (Red Sea) | frontdesk.rsp@grandnile.com | Front@123 | only the Red Sea hotel |
| Cashier | cashier@grandnile.com | Cashier@123 | restaurant, rooftop, QR |
| Accountant | accountant@grandnile.com | Account@123 | accounts, cash, stock, trips |
| Storekeeper | store@grandnile.com | Store@123 | stock only |
| Hotel administrator | hoteladmin@grandnile.com | HotelAdmin@123 | everything for the Nile hotel |

## Using it on several devices and for QR menus
- Run it on one computer in the hotel (or on a hosting server). Other PCs, tablets and phones open `http://<that computer's address>:5173` in their browser (for example `http://192.168.1.20:5173`).
- For guests' phones, open **QR menus**, type the address guests can reach (hotel Wi-Fi address or your website), check the codes, and press **Print**.
- For real use: `npm --prefix client run build`, then `npm --prefix server start`. The server then serves everything on port 4000.

## Backups
Every night at 03:00 a full copy of **all hotels** is saved in `server/backups` (last 30 kept). Make one any time from **Users & settings → Backups**. Restore: `cd server` then `npm run restore -- backups/FILE.json`. Copy the folder to another disk regularly.

## Before real use
Change `JWT_SECRET` in `server/.env`, change every demo password, and delete the demo users you do not need.

## Layout
```
server/src  models.js  services.js (accounting engine)  reports.js  excel.js  routes.js  routes2.js  public.js  auth.js  backup.js  restore.js  seed.js  index.js
client/src  App.jsx  api.js  ui.jsx  SalesReport.jsx  pages/{Dashboard,Group,FrontDesk,GuestAccounts,Restaurant,Qr,Inventory,Trips,Cash,Accounting,Admin,PublicMenu}.jsx
```
