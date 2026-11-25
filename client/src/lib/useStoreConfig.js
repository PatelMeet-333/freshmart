import { useEffect, useState } from 'react';
import { getGatewayConfig } from './payments.js';

/** Delivery fee and payment hold time, as set on the server. */
export function useStoreConfig() {
  const [config, setConfig] = useState(null);
  useEffect(() => {
    getGatewayConfig()
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);
  return config;
}
