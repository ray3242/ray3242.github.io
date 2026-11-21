/* Payment settings. Both values are public and safe to commit.
   Leave them empty and every feature is open (launch preview).
   Fill them in and files over FREE_ROWS transactions need a licence key from Gumroad. */
window.QBODROP_CONFIG = {
  gumroadUrl: '',        // e.g. https://rayhan.gumroad.com/l/qbodrop
  gumroadProductId: '',  // Gumroad product page > Content > License key > "product_id"
  price: '$29',
  freeRows: 10
};
