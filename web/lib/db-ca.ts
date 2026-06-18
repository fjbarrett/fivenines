// Pinned CA for the self-hosted DigitalOcean Postgres (209.38.79.145). This is the
// server's PUBLIC self-signed certificate — safe to commit. Used by web/lib/db.ts
// (and mirrored in scanner/upload.mjs) to verify the TLS chain and prevent a
// man-in-the-middle from impersonating the DB to harvest credentials.
//
// ROTATION: this cert expires 2027-03-29. When the server cert is regenerated,
// refresh this constant (and the copy in scanner/upload.mjs) with:
//   ssh frank@209.38.79.145 'openssl s_client -starttls postgres \
//     -connect 127.0.0.1:5432 </dev/null 2>/dev/null | openssl x509 -outform PEM'
export const POSTGRES_CA = `-----BEGIN CERTIFICATE-----
MIIDETCCAfmgAwIBAgIUaH6iy0m1LERJtp+jAOtiZhCb+oAwDQYJKoZIhvcNAQEL
BQAwGDEWMBQGA1UEAwwNMjA5LjM4Ljc5LjE0NTAeFw0yNjAzMjkxNDM3MjJaFw0y
NzAzMjkxNDM3MjJaMBgxFjAUBgNVBAMMDTIwOS4zOC43OS4xNDUwggEiMA0GCSqG
SIb3DQEBAQUAA4IBDwAwggEKAoIBAQCUF832I4GhSr4SqTCCLRV3C5dmcTcMf4SA
kI506g2bSVPLI+jGIFzJxtGHnDj8BDTadeMe09fhYsW9hwj90/XZh6ZQEWBjiVWu
YDolRU7mLYFT3x1ppb0BLPjOmnlQGl/Je3Ag/QNpengBkdJ/nIzePOGEYeVJJzdm
vS6fN6vJQLlb4E2vG/6crpY4jWtoy+9Vz1lwcXXKW5kgQZJTfeX7eTlWw7KGPFho
Qwaf9AoILoWlHP4pa1idK8hnfrl/ByVuobSTJ397e348UkZvOQ7UQYPjhODPHsC4
LC4dU+sCaBsfleDt1Hje7K5AHq4f33bbNPX272AGhKkne0x/I5flAgMBAAGjUzBR
MB0GA1UdDgQWBBRHENZKL0DfppmvGWxfUZbpMYaAcDAfBgNVHSMEGDAWgBRHENZK
L0DfppmvGWxfUZbpMYaAcDAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3DQEBCwUA
A4IBAQA+n4XC+ZCDnQ3sn6ornY9Uo0ak2uD5BK1F3bDaO3cB/eOwaXBN0V9OXUp3
7tljKN258LYMvqzOyxddxUTW5ADKfRcqJqqhXIJNbIwKWxm5oGKra+3QH0v2/Ndn
8ulElm6PtCFIr2P/YnRIdmQhhPcmZ1gs3V1ks5Nx0krnCIEemOGuRgLRP2YY3XLj
bYqRmCQqxOmkPU33cS3hqDutBFnjUPGSuxeV+EJPGk8wq4XlwJ3V0KVN6k5EJHLw
yZCMHgslQYx2572w/SjZtfzu9kltjpCQXqkL1i0Z53kV2bVLOs1WjcC94cZe9mnG
aniQ/md1Lv52NIZAw15XAda0xFVZ
-----END CERTIFICATE-----
`;
