# Legacy Tech Solutions Storefront

A Vite + React single-page experience inspired by the dark enterprise storefront mockups provided. It ships with Tailwind CSS styling, React Router navigation, and a persistent cart context backed by localStorage.

## Available Scripts
- `npm install` to install dependencies
- `npm run dev` to start the development server
- `npm run build` to create a production build
- `npm run preview` to preview the production build

## Project Structure
- `src/main.jsx` entry point with router and cart provider
- `src/App.jsx` route map
- `src/routes/` for Home, Products, Product Detail, Cart, Checkout, and Not Found views
- `src/components/` shared UI elements like Header, Footer, Breadcrumbs, and cards
- `src/context/CartContext.jsx` cart state with localStorage persistence
- `src/data/products.js` product catalog data
- `src/styles/global.css` Tailwind directives and shared utility classes
