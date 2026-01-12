
import React, { createContext, useContext, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { NavigationContextType, NavigationState, PageName } from './types.ts';

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

const PATH_MAP: Record<PageName, string> = {
  HOME: '/',
  PRODUCTS: '/products',
  PRODUCT_DETAIL: '/product',
  CART: '/cart',
  CHECKOUT: '/checkout',
  SUPPORT: '/support',
  PRIVACY_POLICY: '/privacy-policy',
  TERMS_OF_SERVICE: '/terms-of-service',
};

export const NavigationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const navigateHook = useNavigate();
  const location = useLocation();

  // Helper to reverse map current path to PageName (rough estimation for UI state)
  const getPageFromPath = (path: string): PageName => {
    if (path === '/') return 'HOME';
    if (path.startsWith('/products')) return 'PRODUCTS';
    if (path.startsWith('/product/')) return 'PRODUCT_DETAIL';
    if (path === '/cart') return 'CART';
    if (path === '/checkout') return 'CHECKOUT';
    if (path === '/support') return 'SUPPORT';
    if (path === '/privacy-policy') return 'PRIVACY_POLICY';
    if (path === '/terms-of-service') return 'TERMS_OF_SERVICE';
    return 'HOME';
  };

  const currentPage: NavigationState = {
    page: getPageFromPath(location.pathname),
    params: location.pathname.startsWith('/product/') ? { id: location.pathname.split('/').pop() } : undefined
  };

  const navigate = (page: PageName, params?: any) => {
    window.scrollTo(0, 0);
    let path = PATH_MAP[page];
    if (page === 'PRODUCT_DETAIL' && params?.id) {
      path = `${path}/${params.id}`;
    }
    navigateHook(path);
  };

  return (
    <NavigationContext.Provider value={{ currentPage, navigate }}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};
