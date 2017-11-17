from __future__ import print_function
import sys
import json
import numpy as np
from os.path import isfile, join
from os import listdir
from datetime import datetime as dt
from sklearn.gaussian_process import GaussianProcessRegressor as GPR
from sklearn import preprocessing

path = './public/'
n_test = 200                                            # test set size

print('Preprocessing...', end='')
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
data = data[data[:,2].argsort()] # sort by time
times = data[:,2]
data[:,2] = np.round((times - times[0])/3600)     # start time from 0, 1hr precision
last24h = np.sum(times>(times[-1]-24))
last48h = np.sum(times>(times[-1]-48))
last72h = np.sum(times>(times[-1]-72))
X = data[:,0:2]
y = data[:,3]

# Normalize X
scaler = preprocessing.StandardScaler().fit(X)
X = scaler.transform(X)

print(' Done')
print('')
print('N# measurements from last 24hrs:', last24h)
print('N# measurements from last 48hrs:', last48h)
print('N# measurements from last 72hrs:',  last72h)
print('Total n# measurements:',  len(X))
print('')
print('To predict o3 for lat 55, long 60 use: model.predict(scaler.transform([[55,60]]))')
print('')

def test(model, X_test, y_test):
    print('Testing...' % last24h, end='')
    sys.stdout.flush()
    print(' R-squared: %f' % model.score(X_test, y_test))

def train_and_test(n):
    # Separate test set from training set
    test_set_indices = np.unique(np.random.randint(len(X)-n, len(X), size=n_test))
    X_test = X[test_set_indices]
    X_train = np.delete(X, test_set_indices, axis=0)
    y_test = y[test_set_indices]
    y_train = np.delete(y, test_set_indices, axis=0)

    print('Using model:')
    gpr = GPR(normalize_y=True, n_restarts_optimizer=10, alpha=0.01)
    print(gpr)
    print('Training with %d measurements...' % last24h, end='')
    sys.stdout.flush()
    model = gpr.fit(X_train[-n:], y_train[-n:]) # train with data from last 24hrs
    print(' Done')

    test(model, X_test, y_test)

    return model

model = train_and_test(last24h)
