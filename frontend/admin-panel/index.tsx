import React from 'react';
import ReactDOM from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import App from './App';
import {QueryClientProvider, QueryClient} from "@tanstack/react-query";


const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error("Could not find root element to mount to");
}

const queryLts = new QueryClient();

const root = ReactDOM.createRoot(rootElement);
root.render(
    <React.StrictMode>
        <BrowserRouter>
            <QueryClientProvider client={queryLts}>
                < App/>
            </QueryClientProvider>
        </BrowserRouter>
    </React.StrictMode>
);