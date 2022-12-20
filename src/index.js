import './wdyr';

import React from 'react';
import ReactDOM from 'react-dom/client';
import {
  BrowserRouter,
  Route,
  Routes
} from "react-router-dom";
import App from './App';
import './index.css';
//@ts-ignore
import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";
import TimeAgo from 'javascript-time-ago';
import en from 'javascript-time-ago/locale/en.json';
import Browser from './Browser';
import Deforum from './Deforum';
import Interpreter from './Interpreter';
import reportWebVitals from './reportWebVitals';

Sentry.init({
  dsn: "https://4706cbba5987462184a3e541c4b8a9d4@o175750.ingest.sentry.io/4504274009325568",
  integrations: [new BrowserTracing()],
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});

TimeAgo.addDefaultLocale(en)

const router = <BrowserRouter>
    <Routes>
      <Route path="/" element={<Deforum />} />
      <Route path="/deforum" element={<Deforum />} />
      <Route path="/browser" element={<Browser />} />
      <Route path="/interpreter" element={<Interpreter />} />            
      <Route path="/legacy" element={<App />} />
    </Routes>
</BrowserRouter>

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    {router}
  </React.StrictMode>
);

reportWebVitals(console.log);
