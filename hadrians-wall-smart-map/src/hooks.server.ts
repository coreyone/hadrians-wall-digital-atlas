import type { Handle } from '@sveltejs/kit';

const PERMISSIONS_POLICY =
    'accelerometer=(self), gyroscope=(self), magnetometer=(self), geolocation=(self)';

export const handle: Handle = async ({ event, resolve }) => {
    const response = await resolve(event);
    response.headers.set('Permissions-Policy', PERMISSIONS_POLICY);
    return response;
};

