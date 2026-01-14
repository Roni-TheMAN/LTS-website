import React, { useCallback, useState, useEffect } from 'react';
import {BrowserRouter, Routes, Route, useLocation, Navigate, useSearchParams} from 'react-router-dom';
import {loadStripe} from '@stripe/stripe-js';
import {
    EmbeddedCheckoutProvider,
    EmbeddedCheckout
} from '@stripe/react-stripe-js';

import { useCart } from '../src/CartContext.tsx';


import {NavigationProvider} from './NavigationContext.tsx';
import {CartProvider} from './CartContext.tsx';
import {SearchProvider} from '../SearchContext.tsx';
import Header from '../components/Header.tsx';
import Footer from '../components/Footer.tsx';
import HomePage from '../pages/HomePage.tsx';
import ProductsPage from '../pages/ProductsPage.tsx';
import ProductDetailPage from '../pages/ProductDetailPage.tsx';
import CartPage from '../pages/CartPage.tsx';
// import CheckoutPage from '../pages/CheckoutPage.tsx';
import SupportPage from '../pages/SupportPage.tsx';
import PrivacyPolicyPage from '../pages/PrivacyPolicyPage.tsx';
import TermsOfServicePage from '../pages/TermsOfServicePage.tsx';
import KeycardDesignsPage from "@/pages/KeycardDesignsPage.tsx";
import SolutionsPage from "@/pages/SolutionsPage.tsx";
import OrdersPage from "@/pages/OrdersPage.tsx";
import CheckoutReturnPage from "@/pages/CheckoutReturnPage.tsx";


const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const CheckoutForm = () => {
    const { items, cartTotal } = useCart();

    // TO DO, Call a Function to create Draft Order


    const fetchClientSecret = useCallback(() => {
        return fetch(`${import.meta.env.VITE_ADMIN_API_BASE_URL}/create-checkout-session`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items }),
        })
            .then((res) => {
                if (!res.ok) throw new Error(`create-checkout-session failed: ${res.status}`);
                return res.json();
            })
            .then((data) => data.clientSecret);
    }, [items]);

    const options = {fetchClientSecret};

    return (
        <div id="checkout">
            <EmbeddedCheckoutProvider
                stripe={stripePromise}
                options={options}
            >
                <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
        </div>
    )
}

const Return: React.FC = () => {
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get("session_id");

    const { clearCart } = useCart();
    const [status, setStatus] = useState<null | string>(null);
    const [customerEmail, setCustomerEmail] = useState("");

    useEffect(() => {
        if (!sessionId) return;

        const url = `${import.meta.env.VITE_ADMIN_API_BASE_URL}/session-status?session_id=${encodeURIComponent(sessionId)}`;

        fetch(url, { method: "GET" })
            .then((res) => {
                if (!res.ok) throw new Error(`session-status failed: ${res.status}`);
                return res.json();
            })
            .then((data) => {
                setStatus(data.status);
                setCustomerEmail(data.customer_email || "");
            })
            .catch(() => {
                setStatus("error");
            });
    }, [sessionId]);

    // ✅ Clear cart AFTER we know it's paid/complete
    useEffect(() => {
        if (status === "complete") {
            clearCart();
        }
    }, [status, clearCart]);

    if (!sessionId) return <Navigate to="/cart" replace />;

    if (status === "open") return <Navigate to="/checkout" replace />;

    if (status === "complete") return <CheckoutReturnPage />;

    if (status == null) return <div className="p-6">Verifying your payment…</div>;

    return <div className="p-6">Something went wrong verifying your payment.</div>;
};



const AppLayout: React.FC<{ children: React.ReactNode }> = ({children}) => {
    const location = useLocation();
    const isCheckout = location.pathname === "/checkout" || location.pathname === "/return";

    if (isCheckout) {
        return <>{children}</>;
    }

    return (
        // FIX: Added 'w-full' and 'overflow-x-hidden' to prevent HomePage transforms
        // from expanding the document width and shifting the sticky header.
        <div className="flex flex-col min-h-screen w-full overflow-x-hidden">
            <Header/>
            <div className="flex-grow">
                {children}
            </div>
            <Footer/>
        </div>
    );
};

const App: React.FC = () => {
    return (
        <BrowserRouter>
            <SearchProvider>
                <CartProvider>
                    <NavigationProvider>
                        <AppLayout>
                            <Routes>
                                <Route path="/" element={<HomePage/>}/>
                                <Route path="/products" element={<ProductsPage/>}/>
                                <Route path="/product/:id" element={<ProductDetailPage/>}/>
                                <Route path="/cart" element={<CartPage/>}/>
                                <Route path="/checkout" element={<CheckoutForm />}/>
                                <Route path="/support" element={<SupportPage/>}/>
                                <Route path="/privacy-policy" element={<PrivacyPolicyPage/>}/>
                                <Route path="/terms-of-service" element={<TermsOfServicePage/>}/>
                                <Route path="/rfid-keycards" element={<KeycardDesignsPage/>}/>
                                <Route path="/solutions" element={<SolutionsPage/>}/>
                                <Route path="/orders" element={<OrdersPage/>}/>
                                <Route path="/return" element={<Return />}/>


                                <Route path="*" element={<HomePage/>}/>
                            </Routes>
                        </AppLayout>
                    </NavigationProvider>
                </CartProvider>
            </SearchProvider>
        </BrowserRouter>
    );
};

export default App;