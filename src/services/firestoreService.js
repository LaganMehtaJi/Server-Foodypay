import { firestoreDb, isFirestoreReady } from '../config/firebase.js';

/**
 * Remove undefined values or functions before pushing to Firestore
 */
const sanitizeDoc = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  const clean = {};
  Object.keys(obj).forEach((key) => {
    const val = obj[key];
    if (val !== undefined && typeof val !== 'function') {
      if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
        clean[key] = sanitizeDoc(val);
      } else {
        clean[key] = val;
      }
    }
  });
  return clean;
};

// ============================================================================
// ORDERS IN CLOUD FIRESTORE
// ============================================================================

export async function syncOrderToFirestore(order) {
  if (!isFirestoreReady || !firestoreDb || !order) return null;
  try {
    const id = String(order._id || order.id || order.orderId);
    const orderDocRef = firestoreDb.collection('orders').doc(id);

    const plainOrder = typeof order.toObject === 'function' ? order.toObject() : { ...order };
    const payload = sanitizeDoc({
      ...plainOrder,
      _id: id,
      id: id,
      user: String(plainOrder.user || plainOrder.userId || ''),
      createdAt: plainOrder.createdAt ? new Date(plainOrder.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await orderDocRef.set(payload, { merge: true });
    return { success: true, id };
  } catch (err) {
    console.warn('[Firestore] syncOrder error:', err.message);
    return null;
  }
}

export async function updateOrderInFirestore(orderId, updateFields) {
  if (!isFirestoreReady || !firestoreDb || !orderId) return null;
  try {
    const docRef = firestoreDb.collection('orders').doc(String(orderId));
    const cleanPayload = sanitizeDoc({
      ...updateFields,
      updatedAt: new Date().toISOString(),
    });
    await docRef.set(cleanPayload, { merge: true });
    return { success: true };
  } catch (err) {
    console.warn('[Firestore] updateOrder error:', err.message);
    return null;
  }
}

export async function deleteOrderFromFirestore(orderId) {
  if (!isFirestoreReady || !firestoreDb || !orderId) return null;
  try {
    await firestoreDb.collection('orders').doc(String(orderId)).delete();
    return { success: true };
  } catch (err) {
    console.warn('[Firestore] deleteOrder error:', err.message);
    return null;
  }
}

export async function getOrdersFromFirestore(userId, limitCount = 100) {
  if (!isFirestoreReady || !firestoreDb) return [];
  try {
    let q = firestoreDb.collection('orders');
    if (userId) {
      q = q.where('user', '==', String(userId));
    }
    const snap = await q.limit(limitCount).get();
    const orders = [];
    snap.forEach((doc) => orders.push({ id: doc.id, ...doc.data() }));
    return orders;
  } catch (err) {
    console.warn('[Firestore] getOrders error:', err.message);
    return [];
  }
}

// ============================================================================
// CUSTOMER DUES (KHATA / UDHAAR) IN CLOUD FIRESTORE
// ============================================================================

export async function recordCustomerDueInFirestore(dueData) {
  if (!isFirestoreReady || !firestoreDb || !dueData) return null;
  try {
    const id = String(dueData.id || dueData._id || `due_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
    const docRef = firestoreDb.collection('customer_dues').doc(id);

    const payload = sanitizeDoc({
      ...dueData,
      id,
      status: dueData.status || 'unpaid',
      createdAt: dueData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await docRef.set(payload, { merge: true });
    return { success: true, id, data: payload };
  } catch (err) {
    console.warn('[Firestore] recordCustomerDue error:', err.message);
    return null;
  }
}

export async function settleCustomerDueInFirestore(dueId, settleData = {}) {
  if (!isFirestoreReady || !firestoreDb || !dueId) return null;
  try {
    const docRef = firestoreDb.collection('customer_dues').doc(String(dueId));
    const payload = sanitizeDoc({
      status: 'paid',
      isPaid: true,
      clearedAt: new Date().toISOString(),
      settledMode: settleData.mode || 'Cash',
      settledAmount: settleData.amount,
      note: settleData.note || 'Settled and cleared',
      updatedAt: new Date().toISOString(),
    });
    await docRef.set(payload, { merge: true });
    return { success: true, data: payload };
  } catch (err) {
    console.warn('[Firestore] settleCustomerDue error:', err.message);
    return null;
  }
}

export async function getCustomerDuesFromFirestore(userId, phone) {
  if (!isFirestoreReady || !firestoreDb) return [];
  try {
    let q = firestoreDb.collection('customer_dues');
    if (phone) {
      q = q.where('phone', '==', String(phone).trim());
    } else if (userId) {
      q = q.where('user', '==', String(userId));
    }
    const snap = await q.limit(100).get();
    const dues = [];
    snap.forEach((doc) => dues.push({ id: doc.id, ...doc.data() }));
    return dues;
  } catch (err) {
    console.warn('[Firestore] getCustomerDues error:', err.message);
    return [];
  }
}

// ============================================================================
// TABLES & DISHES & CUSTOMERS IN CLOUD FIRESTORE
// ============================================================================

export async function syncTableToFirestore(table) {
  if (!isFirestoreReady || !firestoreDb || !table) return null;
  try {
    const id = String(table._id || table.id || `table_${Date.now()}`);
    const plain = typeof table.toObject === 'function' ? table.toObject() : { ...table };
    await firestoreDb.collection('tables').doc(id).set(sanitizeDoc({
      ...plain,
      id,
      _id: id,
      user: String(plain.user || ''),
      updatedAt: new Date().toISOString(),
    }), { merge: true });
    return { success: true, id };
  } catch (err) {
    console.warn('[Firestore] syncTable error:', err.message);
    return null;
  }
}

export async function deleteTableFromFirestore(tableId) {
  if (!isFirestoreReady || !firestoreDb || !tableId) return null;
  try {
    await firestoreDb.collection('tables').doc(String(tableId)).delete();
    return { success: true };
  } catch (err) {
    console.warn('[Firestore] deleteTable error:', err.message);
    return null;
  }
}

export async function syncDishToFirestore(dish) {
  if (!isFirestoreReady || !firestoreDb || !dish) return null;
  try {
    const id = String(dish._id || dish.id || `dish_${Date.now()}`);
    const plain = typeof dish.toObject === 'function' ? dish.toObject() : { ...dish };
    await firestoreDb.collection('dishes').doc(id).set(sanitizeDoc({
      ...plain,
      id,
      _id: id,
      user: String(plain.user || ''),
      updatedAt: new Date().toISOString(),
    }), { merge: true });
    return { success: true, id };
  } catch (err) {
    console.warn('[Firestore] syncDish error:', err.message);
    return null;
  }
}

export async function deleteDishFromFirestore(dishId) {
  if (!isFirestoreReady || !firestoreDb || !dishId) return null;
  try {
    await firestoreDb.collection('dishes').doc(String(dishId)).delete();
    return { success: true };
  } catch (err) {
    console.warn('[Firestore] deleteDish error:', err.message);
    return null;
  }
}

export async function syncCustomerToFirestore(customer) {
  if (!isFirestoreReady || !firestoreDb || !customer) return null;
  try {
    const id = String(customer._id || customer.id || `cust_${Date.now()}`);
    const plain = typeof customer.toObject === 'function' ? customer.toObject() : { ...customer };
    await firestoreDb.collection('customers').doc(id).set(sanitizeDoc({
      ...plain,
      id,
      _id: id,
      user: String(plain.user || ''),
      updatedAt: new Date().toISOString(),
    }), { merge: true });
    return { success: true, id };
  } catch (err) {
    console.warn('[Firestore] syncCustomer error:', err.message);
    return null;
  }
}
