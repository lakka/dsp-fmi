from __future__ import print_function
import sys
import numpy as np
from datetime import datetime as dt
from sklearn.gaussian_process import GaussianProcessRegressor as GPR
from preprocess import read_data, data2grid, take_n_last_days

def test(model, X_test, y_test):
    print('Testing...', end='')
    sys.stdout.flush()
    score = model.score(X_test, y_test)
    print(' R-squared: %f' % score)
    return score

def train_and_test(X, y):
    #scaler = preprocessing.StandardScaler().fit(X)
    #X = scaler.transform(X)
    #yesterday = scaler.transform([[0,0,int(dt.utcnow().strftime('%s'))-(3600*24)]])[0][2]
    minx = np.min(X)
    X = (X-np.min(X))/3600
    yesterday = (int(dt.utcnow().strftime('%s'))-(3600*24)-minx)/3600
    #time = X[:,2]
    X_train = X[X < yesterday]
    X_test = X[X >= yesterday]
    y_train = y[X < yesterday]
    y_test = y[X >= yesterday]
    if len(X_test) == 0:
        print('zero sized test set, skipping')
        return None
    if len(X_train) == 0:
        print('zero sized train set, skipping')
        return None


    gpr = GPR(normalize_y=True, copy_X_train=False, n_restarts_optimizer=10, alpha=0.001)
    print('Training (n train %d, n test %d)...' % (len(X_train),len(X_test)), end='')
    sys.stdout.flush()
    model = gpr.fit(X_train.reshape(-1,1), y_train)
    print(' Done')

    score = test(model, X_test.reshape(-1,1), y_test)

    return (model, score, len(X_train))

data = read_data()

days = 2
data = take_n_last_days(data, days)
grid = data2grid(data)

models = [[None]*180]*90
scores = np.zeros([1,2])
for x in list(enumerate(grid)):
    for y in list(enumerate(x[1])):
        d = y[1]
        if len(d) == 0:
            continue
        print('(%d, %d)' % (x[0]*2-90, y[0]*2-180))
        curmod = train_and_test(d[:,2], d[:,3])
        if curmod:
            models[x[0]][y[0]] = curmod
            scores = np.append(scores, [[curmod[1], curmod[2]]], axis=0)

scores = np.delete(scores, 0, axis=0)
print(' Done')
print('')
print('used last %d days of data for training' % days)
print('models trained: %d' % len(scores))
print('avg train set size per model: %f, min %d, max %d' % (np.mean(scores[:,1]), np.min(scores[:,1]), np.max(scores[:,1])))
print('total R-squared median: %f' % np.median(scores[:,0]))

#data = data[data[:,0].argsort()] # sort by latitude
#data = np.array_split(data, n_models, axis=0)
#metadata = np.asarray([(a.min(axis=0)[0],a.max(axis=0)[0]) for a in data])
#data = data[data[:,2].argsort()] # sort by time
