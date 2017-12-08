from __future__ import print_function
import sys
import json
import numpy as np
from os.path import isfile, join
from os import listdir
from datetime import datetime as dt

def read():
    path = './public/'
    print('Reading data...', end='')
    sys.stdout.flush()
    all_data = []
    onlyfiles = [join(path,f) for f in listdir(path) if isfile(join(path, f)) and '.json' in f]
    for fname in onlyfiles:
	all_data += [zip(d['data'], [[dt.strptime(d['time'], '%Y-%m-%dT%H:%M:%S.%fZ').strftime('%s')]]*len(d['data'])) for d in json.load(open(fname, 'r')) if len(d['time']) > 21]

    flat_data = []
    for a in all_data:
	for b in a:
	    flat_data += [b[0] + b[1]]

    data = np.array(flat_data).astype('f')
    data[:,[3,2]] = data[:,[2,3]]    # swap columns time and o3
    print(' Read %d entries' % len(data))

    return data

def random_sets(X, y, n_test):
    # Separate test set from training set, random indices
    test_set_indices = np.unique(np.random.randint(0, len(X), size=n_test))
    X_test = X[test_set_indices]
    X_train = np.delete(X, test_set_indices, axis=0)
    y_test = y[test_set_indices]
    y_train = np.delete(y, test_set_indices, axis=0)

    return (X_train, X_test, y_train, y_test)
