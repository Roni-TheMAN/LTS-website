import React from 'react';
import {useNavigation} from '../src/NavigationContext.tsx';
import logo from '../static/logo/LTSpnglogo.png';


const Footer: React.FC = () => {
    const {navigate} = useNavigation();

    return (
        <footer className="bg-white border-t border-gray-200 pt-20 pb-10 mt-auto">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
                    <div className="flex flex-col gap-6">
                        <div
                            className="flex items-center gap-3 cursor-pointer"
                            onClick={() => navigate('HOME')}
                        >
                            <img
                                src={logo}
                                alt="Legacy Tech Solutions"
                                className="h-12 md:h-14 w-auto object-contain"
                            />
                            </div>
                        <p className="text-sm text-gray-500 leading-relaxed">
                            Empowering businesses with next-generation security, communication, and networking
                            infrastructure since 2010.
                        </p>
                    </div>
                    <div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 mb-6">Shop</h3>
                        <ul className="space-y-4">
                            <li>
                                <button onClick={() => navigate('PRODUCTS')}
                                        className="text-sm text-gray-600 hover:text-blue-600 transition-colors text-left">Access
                                    Control
                                </button>
                            </li>
                            <li>
                                <button onClick={() => navigate('PRODUCTS')}
                                        className="text-sm text-gray-600 hover:text-blue-600 transition-colors text-left">VoIP
                                    Phones
                                </button>
                            </li>
                            <li>
                                <button onClick={() => navigate('PRODUCTS')}
                                        className="text-sm text-gray-600 hover:text-blue-600 transition-colors text-left">Surveillance
                                </button>
                            </li>
                            <li>
                                <button onClick={() => navigate('PRODUCTS')}
                                        className="text-sm text-gray-600 hover:text-blue-600 transition-colors text-left">Networking
                                </button>
                            </li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 mb-6">Company</h3>
                        <ul className="space-y-4">
                            <li>
                                <button
                                    className="text-sm text-gray-600 hover:text-blue-600 transition-colors text-left">About
                                    Us
                                </button>
                            </li>
                            <li>
                                <button onClick={() => navigate('SUPPORT')}
                                        className="text-sm text-gray-600 hover:text-blue-600 transition-colors text-left">Contact
                                </button>
                            </li>
                            <li>
                                <button
                                    className="text-sm text-gray-600 hover:text-blue-600 transition-colors text-left">Partners
                                </button>
                            </li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 mb-6">Contact</h3>
                        <ul className="space-y-4">
                            <li className="flex items-center gap-3 text-sm text-gray-600">
                                <span
                                    className="material-symbols-outlined text-blue-600 text-sm">mail</span> support@legacytech.com
                            </li>
                            <li className="flex items-center gap-3 text-sm text-gray-600">
                                <span className="material-symbols-outlined text-blue-600 text-sm">call</span> +1 (800)
                                555-0123
                            </li>
                            <li className="flex items-center gap-3 text-sm text-gray-600">
                                <span className="material-symbols-outlined text-blue-600 text-sm">location_on</span> 123
                                Tech Park, CA
                            </li>
                        </ul>
                    </div>
                </div>
                <div
                    className="border-t border-gray-100 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-sm text-gray-500">© 2023 Legacy Tech Solutions. All rights reserved.</p>
                    <div className="flex gap-6">
                        <button
                            onClick={() => navigate('PRIVACY_POLICY')}
                            className="text-sm text-gray-500 hover:text-blue-600 transition-colors"
                        >
                            Privacy Policy
                        </button>
                        <button
                            onClick={() => navigate('TERMS_OF_SERVICE')}
                            className="text-sm text-gray-500 hover:text-blue-600 transition-colors"
                        >
                            Terms of Service
                        </button>
                        <button className="text-sm text-gray-500 hover:text-blue-600 transition-colors">Sitemap</button>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
