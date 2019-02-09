/* eslint no-constant-condition: 0 */

/* eslint-disable */

/**
 * Mnemonist FixedFixedCritBitTreeMap
 * ===================================
 *
 * TODO...
 *
 * [References]:
 * https://cr.yp.to/critbit.html
 * https://www.imperialviolet.org/binary/critbit.pdf
 */
var bitwise = require('./utils/bitwise.js'),
    typed = require('./utils/typed-arrays.js');

/**
 * Helpers.
 */

/**
 * Helper returning the direction we need to take given a key and an
 * encoded critbit.
 *
 * @param  {string} key     - Target key.
 * @param  {number} critbit - Packed address of byte + mask.
 * @return {number}         - 0, left or 1, right.
 */
function getDirection(key, critbit) {
  var byteIndex = critbit >> 8;

  if (byteIndex > key.length - 1)
    return 0;

  var byte = key.charCodeAt(byteIndex),
      mask = critbit & 0xff;

  return (1 + (byte | mask)) >> 8;
}

/**
 * Helper returning the packed address of byte + mask or -1 if strings
 * are identical.
 *
 * @param  {string} a      - First key.
 * @param  {string} b      - Second key.
 * @return {number}        - Packed address of byte + mask.
 */
function findCriticalBit(a, b) {
  var i = 0,
      tmp;

  // Swapping so a is the shortest
  if (a.length > b.length) {
    tmp = b;
    b = a;
    a = tmp;
  }

  var l = a.length,
      mask;

  while (i < l) {
    if (a[i] !== b[i]) {
      mask = bitwise.criticalBit8Mask(
        a.charCodeAt(i),
        b.charCodeAt(i)
      );

      return (i << 8) | mask;
    }

    i++;
  }

  // Strings are identical
  if (a.length === b.length)
    return -1;

  // NOTE: x ^ 0 is the same as x
  mask = bitwise.criticalBit8Mask(b.charCodeAt(i));

  return (i << 8) | mask;
}

/**
 * FixedCritBitTreeMap.
 *
 * @constructor
 */
function FixedCritBitTreeMap(capacity) {

  if (typeof capacity !== 'number' || capacity <= 0)
    throw new Error('mnemonist/fixed-critbit-tree-map: `capacity` should be a positive number.');

  // Properties
  this.capacity = capacity;
  this.offset = 0;
  this.root = 0;
  this.size = 0;

  var PointerArray = typed.getSignedPointerArray(capacity + 1);

  this.keys = new Array(capacity);
  this.values = new Array(capacity);
  this.lefts = new PointerArray(capacity - 1);
  this.rights = new PointerArray(capacity - 1);
  this.critbits = new Uint32Array(capacity);
}

/**
 * Method used to clear the FixedCritBitTreeMap.
 *
 * @return {undefined}
 */
FixedCritBitTreeMap.prototype.clear = function() {

  // Properties
  // TODO...
  this.root = null;
  this.size = 0;
};

/**
 * Method used to set the value of the given key in the trie.
 *
 * @param  {string}         key   - Key to set.
 * @param  {any}            value - Arbitrary value.
 * @return {FixedCritBitTreeMap}
 */
FixedCritBitTreeMap.prototype.set = function(key, value) {
  var pointer;

  // TODO: yell if capacity is already full!

  // Tree is empty
  if (this.size === 0) {
    this.keys[0] = key;
    this.values[0] = value;

    this.size++;

    this.root = -1;

    return this;
  }

  // Walk state
  var pointer = this.root,
      newPointer,
      leftOrRight,
      opposite,
      ancestors = [],
      path = [],
      ancestor,
      parent,
      child,
      critbit,
      internal,
      best,
      dir,
      i,
      l;

  // Walking the tree
  while (true) {

    // Traversing an internal node
    if (pointer > 0) {
      pointer -= 1;

      // Choosing the correct direction
      dir = getDirection(key, this.critbits[pointer]);

      leftOrRight = dir === 0 ? this.lefts : this.rights;
      newPointer = leftOrRight[pointer];

      if (newPointer === 0) {

        // Creating a fitting external node
        pointer = this.size++;
        leftOrRight[newPointer] = -(pointer + 1);
        this.keys[pointer] = key;
        this.values[pointer] = value;
        return this;
      }

      ancestors.push(pointer);
      path.push(dir);
      pointer = newPointer;
    }

    // Reaching an external node
    else {
      pointer = -pointer;
      pointer -= 1;

      // 1. Creating a new external node
      critbit = findCriticalBit(key, this.keys[pointer]);

      // Key is identical, we just replace the value
      if (critbit === -1) {
        this.values[pointer] = value;
        return this;
      }

      internal = this.offset++;
      newPointer = this.size++;

      this.keys[newPointer] = key;
      this.values[newPointer] = value;

      this.critbits[internal] = critbit;

      dir = getDirection(key, critbit);
      leftOrRight = dir === 0 ? this.lefts : this.rights;
      opposite = dir === 0 ? this.rights : this.lefts;

      leftOrRight[internal] = -(newPointer + 1);
      opposite[internal] = -(pointer + 1);

      // 2. Bubbling up
      best = -1;
      l = ancestors.length;

      for (i = l - 1; i >= 0; i--) {
        ancestor = ancestors[i];

        if (this.critbits[ancestor] > critbit)
          continue;

        best = i;
        break;
      }

      // Do we need to attach to the root?
      if (best < 0) {
        this.root = internal + 1;

        // Need to rewire parent as child?
        if (l > 0) {
          parent = ancestors[0];

          opposite[internal] = parent + 1;
        }
      }

      // Simple case without rotation
      else if (best === l - 1) {
        parent = ancestors[best];
        dir = path[best];

        leftOrRight = dir === 0 ? this.lefts : this.rights;

        leftOrRight[parent] = internal + 1;
      }

      // Full rotation
      else {
        parent = ancestors[best];
        dir = path[best];
        child = ancestors[best + 1];

        opposite[internal] = child + 1;

        leftOrRight = dir === 0 ? this.lefts : this.rights;

        leftOrRight[parent] = internal + 1;
      }

      return this;
    }
  }
};

/**
 * Method used to get the value attached to the given key in the tree or
 * undefined if not found.
 *
 * @param  {string} key   - Key to get.
 * @return {any}
 */
FixedCritBitTreeMap.prototype.get = function(key) {

  // Walk state
  var pointer = this.root,
      dir;

  // Walking the tree
  while (true) {

    // Dead end
    if (pointer === 0)
      return;

    // Traversing an internal node
    if (pointer > 0) {
      pointer -= 1;
      dir = getDirection(key, this.critbits[pointer]);

      pointer = dir === 0 ? this.lefts[pointer] : this.rights[pointer];
    }

    // Reaching an external node
    else {
      pointer = -pointer;
      pointer -= 1;

      if (this.keys[pointer] !== key)
        return;

      return this.values[pointer];
    }
  }
};

/**
 * Method used to return whether the given key exists in the tree.
 *
 * @param  {string} key - Key to test.
 * @return {boolean}
 */
FixedCritBitTreeMap.prototype.has = function(key) {

  // Walk state
  var pointer = this.root,
      dir;

  // Walking the tree
  while (true) {

    // Dead end
    if (pointer === 0)
      return false;

    // Traversing an internal node
    if (pointer > 0) {
      pointer -= 1;
      dir = getDirection(key, this.critbits[pointer]);

      pointer = dir === 0 ? this.lefts[pointer] : this.rights[pointer];
    }

    // Reaching an external node
    else {
      pointer = -pointer;
      pointer -= 1;

      return this.keys[pointer] === key;
    }
  }
};

/**
 * Method used to delete the given key from the tree and return whether the
 * key did exist or not.
 *
 * @param  {string} key - Key to delete.
 * @return {boolean}
 */
FixedCritBitTreeMap.prototype.delete = function(key) {

  // Walk state
  var node = this.root,
      dir;

  var parent = null,
      grandParent = null,
      wentLeftForParent = false,
      wentLeftForGrandparent = false;

  // Walking the tree
  while (true) {

    // Dead end
    if (node === null)
      return false;

    // Traversing an internal node
    if (node instanceof InternalNode) {
      dir = getDirection(key, node.critbit);

      if (dir === 0) {
        grandParent = parent;
        wentLeftForGrandparent = wentLeftForParent;
        parent = node;
        wentLeftForParent = true;

        node = node.left;
      }
      else {
        grandParent = parent;
        wentLeftForGrandparent = wentLeftForParent;
        parent = node;
        wentLeftForParent = false;

        node = node.right;
      }
    }

    // Reaching an external node
    else {
      if (key !== node.key)
        return false;

      this.size--;

      // Rewiring
      if (parent === null) {
        this.root = null;
      }

      else if (grandParent === null) {
        if (wentLeftForParent)
          this.root = parent.right;
        else
          this.root = parent.left;
      }

      else {
        if (wentLeftForGrandparent) {
          if (wentLeftForParent) {
            grandParent.left = parent.right;
          }
          else {
            grandParent.left = parent.left;
          }
        }
        else {
          if (wentLeftForParent) {
            grandParent.right = parent.right;
          }
          else {
            grandParent.right = parent.left;
          }
        }
      }

      return true;
    }
  }
};

/**
 * Method used to iterate over the tree in key order.
 *
 * @param  {function}  callback - Function to call for each item.
 * @param  {object}    scope    - Optional scope.
 * @return {undefined}
 */
FixedCritBitTreeMap.prototype.forEach = function(callback, scope) {
  scope = arguments.length > 1 ? scope : this;

  // Inorder traversal of the tree
  var current = this.root,
      stack = [];

  while (true) {

    if (current !== null) {
      stack.push(current);

      current = current instanceof InternalNode ? current.left : null;
    }

    else {
      if (stack.length > 0) {
        current = stack.pop();

        if (current instanceof ExternalNode)
          callback.call(scope, current.value, current.key);

        current = current instanceof InternalNode ? current.right : null;
      }
      else {
        break;
      }
    }
  }
};

/**
 * Convenience known methods.
 */
FixedCritBitTreeMap.prototype.inspect = function() {
  return this;
};

if (typeof Symbol !== 'undefined')
  FixedCritBitTreeMap.prototype[Symbol.for('nodejs.util.inspect.custom')] = FixedCritBitTreeMap.prototype.inspect;

/**
 * Static @.from function taking an abitrary iterable & converting it into
 * a FixedCritBitTreeMap.
 *
 * @param  {Iterable} iterable - Target iterable.
 * @return {FixedCritBitTreeMap}
 */
// FixedCritBitTreeMap.from = function(iterable) {

// };

/**
 * Exporting.
 */
module.exports = FixedCritBitTreeMap;