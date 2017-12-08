from __future__ import print_function
import sys
import numpy as np
import sklearn.preprocessing as preprocessing
from sklearn.gaussian_process import GaussianProcessRegressor as GPR
from preprocess import random_sets,read_data, take_n_last_days
import json

days = 1

def test(model, X_test, y_test):
    print('Testing...', end='')
    sys.stdout.flush()
    score = model.score(X_test, y_test)
    print(' R-squared: %f' % score)
    return score

def train_and_test(X, y):
    scalerX = preprocessing.StandardScaler().fit(X)
    y = y.reshape(-1,1)
    scalery = preprocessing.StandardScaler().fit(y)
    X = scalerX.transform(X)
    y = scalery.transform(y)
    X_train, X_test, y_train, y_test = random_sets(X, y, len(X)/10)

    gpr = GPR(normalize_y=False, copy_X_train=False, n_restarts_optimizer=10, alpha=0.1)
    print('Training (n train %d, n test %d)...' % (len(X_train),len(X_test)), end='')
    sys.stdout.flush()
    model = gpr.fit(X_train, y_train)
    print(' Done')

    score = test(model, X_test, y_test)

    return (model, scalerX, scalery, score, len(X_train))

data = read_data()

data = take_n_last_days(data, days)
model, scaler, scalery, score, n = train_and_test(data[:,0:2], data[:,3])

n_samples = 20
def predict_all(model, scaler):
    lats = np.arange(-89, 91, 2)
    lats = np.repeat(lats, 180).reshape(-1,1)
    lngs = np.arange(-179, 181, 2)
    lngs = np.tile(lngs.reshape(-1,1), (90,1))
    coords = np.concatenate((lats, lngs), axis=1).astype('f')
    out = []
    for m in list(enumerate(np.split(coords, 10, axis=0))):
        print('%d/10' % m[0])
        normcoords = scaler.transform(m[1])
        samples = model.sample_y(normcoords, n_samples)
        out.append(samples)
    return np.reshape(out, (1,90,180,n_samples))[0]

predictions = predict_all(model, scaler)
predictions = scalery.inverse_transform(predictions)

final_shape = (90,180,1)
maxes = np.max(predictions, axis=2).reshape(final_shape)
mins = np.min(predictions, axis=2).reshape(final_shape)
means = np.mean(predictions, axis=2).reshape(final_shape)

def dump(d):
    d = d.astype('|S8').tolist()
    with open('preds.json', 'w+') as fp:
        json.dump(d, fp)


#data = data[data[:,0].argsort()] # sort by latitude
#data = np.array_split(data, n_models, axis=0)
#metadata = np.asarray([(a.min(axis=0)[0],a.max(axis=0)[0]) for a in data])
#data = data[data[:,2].argsort()] # sort by time
